
"""
Flask backend server for Chart Analysis Assistant
This server provides API endpoints to extract data from charts and ask questions about them
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from werkzeug.utils import secure_filename
import json
import time
from functools import wraps
from werkzeug.serving import WSGIRequestHandler
import socket
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Import the functionality from the Python code
from chart_analyzer import extract_table_from_chart, ask_local_llm, check_ollama_status

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detailed logs during testing
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Disable Flask debug logging
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__)
# Add CORS support - important for frontend access
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:8080", "http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "supports_credentials": True,
        "max_age": 3600
    }
})  # Enable CORS for all routes

# Configure upload folder for chart images
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create uploads folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
app.config['TIMEOUT'] = 60  # Increase timeout to 60 seconds
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour session lifetime

# Configure session
app.secret_key = os.urandom(24)

# Configure socket options for better connection handling
WSGIRequestHandler.protocol_version = "HTTP/1.1"

# Configure requests session with retry strategy
session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=10)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Cache for Ollama status
ollama_status_cache = {
    'last_check': 0,
    'status': None,
    'models': None,
    'cache_duration': 30  # Cache for 30 seconds
}

def get_cached_ollama_status():
    """Get cached Ollama status or check if cache is expired"""
    current_time = time.time()
    if current_time - ollama_status_cache['last_check'] < ollama_status_cache['cache_duration']:
        return ollama_status_cache['status'], ollama_status_cache['models']
    return None, None

def update_ollama_status_cache(status, models):
    """Update the Ollama status cache"""
    ollama_status_cache['last_check'] = time.time()
    ollama_status_cache['status'] = status
    ollama_status_cache['models'] = models

# Helper function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.before_request
def before_request():
    """Set timeout for all requests"""
    request.environ['werkzeug.socket'].settimeout(app.config['TIMEOUT'])

@app.after_request
def after_request(response):
    """Add security headers and handle CORS"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.route('/status', methods=['GET'])
def status():
    """Endpoint to check backend status with connection test"""
    try:
        # Check cache first
        cached_status, cached_models = get_cached_ollama_status()
        if cached_status is not None:
            return jsonify({
                "status": "Backend is running",
                "ollama_available": cached_status,
                "available_models": cached_models
            }), 200

        # Test Ollama connection if cache is expired
        ollama_running, available_models = check_ollama_status()
        update_ollama_status_cache(ollama_running, available_models)
        
        return jsonify({
            "status": "Backend is running",
            "ollama_available": ollama_running,
            "available_models": available_models
        }), 200
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        return jsonify({"status": "Backend is running but Ollama check failed"}), 200

@app.route('/full-status', methods=['GET'])
def full_status():
    """Comprehensive status check including Ollama"""
    logger.info("Checking full system status")
    
    # Check Ollama status
    ollama_running, available_models = check_ollama_status()
    logger.info(f"Ollama status: running={ollama_running}, models={available_models}")
    
    # Add debug information
    debug_info = {}
    
    try:
        # Try to get the detailed Ollama status
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        debug_info["ollama_response"] = {
            "status_code": response.status_code,
            "content_sample": str(response.text)[:200] + "..." if len(response.text) > 200 else response.text
        }
    except Exception as e:
        debug_info["ollama_error"] = str(e)
    
    return jsonify({
        "status": "ok", 
        "ollama_available": ollama_running,
        "available_models": available_models,
        "debug_info": debug_info
    }), 200

@app.route('/ollama-check', methods=['GET'])
def ollama_check():
    """Direct check of Ollama status"""
    logger.info("Directly checking Ollama status")
    
    ollama_running, available_models = check_ollama_status()
    
    debug_info = {}
    # Try a direct request to Ollama
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        debug_info["status_code"] = response.status_code
        debug_info["raw_response"] = response.text[:500]  # First 500 chars
    except Exception as e:
        debug_info["error"] = str(e)
    
    return jsonify({
        "available": ollama_running,
        "models": available_models,
        "debug_info": debug_info
    }), 200

@app.route('/test-ollama', methods=['GET'])
def test_ollama():
    """Test a simple prompt to Ollama"""
    logger.info("Testing Ollama with simple prompt")
    
    try:
        # First check if Ollama is accessible at all
        try:
            # Try to connect to Ollama API
            response = requests.get("http://localhost:11434/api/tags", timeout=5)
            if response.status_code != 200:
                return jsonify({
                    "success": False,
                    "message": f"Ollama API returned status {response.status_code}",
                    "response": response.text[:100] if response.text else ""
                }), 200
        except Exception as e:
            return jsonify({
                "success": False,
                "message": f"Cannot connect to Ollama API: {str(e)}",
            }), 200
        
        # If we got here, we can connect to the Ollama API, now test a model
        # First get available models
        models_response = requests.get("http://localhost:11434/api/tags", timeout=5)
        models_data = models_response.json()
        
        if not models_data.get("models"):
            return jsonify({
                "success": False,
                "message": "Ollama is running but no models are available. Pull a model with 'ollama pull llama3'",
            }), 200
        
        # Use the first available model
        model_to_test = models_data["models"][0]["name"]
        logger.info(f"Testing Ollama with model: {model_to_test}")
        
        # Try a simple generation
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model_to_test,
                "prompt": "Say hello",
                "stream": False
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "success": True,
                "message": f"Ollama is working properly with model {model_to_test}",
                "response": data["response"][:100]  # First 100 chars of response
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": f"Ollama returned error: {response.status_code}",
                "response": response.text
            }), 200
            
    except Exception as e:
        logger.error(f"Error testing Ollama: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error connecting to Ollama: {str(e)}"
        }), 200

@app.route('/models', methods=['GET'])
def models():
    """Get available LLM models"""
    ollama_running, available_models = check_ollama_status()
    if ollama_running:
        return jsonify({"models": available_models}), 200
    else:
        return jsonify({"error": "Ollama service not running"}), 503

@app.route('/extract', methods=['POST'])
def extract():
    """Extract table data from an uploaded chart image"""
    # Check if image file is included in the request
    if 'image' not in request.files:
        logger.error("No image file in request")
        return jsonify({"error": "No image file provided"}), 400
    
    file = request.files['image']
    
    # Check if the file is valid
    if file.filename == '':
        logger.error("Empty filename")
        return jsonify({"error": "No selected file"}), 400
    
    if not allowed_file(file.filename):
        logger.error(f"Invalid file type: {file.filename}")
        return jsonify({"error": "File type not allowed"}), 400
    
    try:
        # Save the uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        logger.info(f"Processing image: {filepath}")
        
        # Extract table data from the image
        title, headers, data, formatted_table, table_str = extract_table_from_chart(filepath)
        
        logger.info(f"Extraction complete. Title: {title}, Headers: {headers}, Data rows: {len(data)}")
        logger.debug(f"Raw table string: {table_str}")
        
        # Convert data to JSON-serializable format
        serializable_data = []
        for row in data:
            row_dict = {}
            for i, header in enumerate(headers):
                if i < len(row):
                    row_dict[header] = row[i]
            serializable_data.append(row_dict)
        
        result = {
            "title": title,
            "headers": headers,
            "data": serializable_data,
            "formatted_table": formatted_table,
            "raw_text": table_str
        }
        
        logger.info("Sending extraction results to frontend")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up the uploaded file
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except:
            pass

@app.route('/question', methods=['POST'])
def question():
    """Ask a question about chart data"""
    # Parse request data
    request_data = request.get_json()
    
    if not request_data or not all(k in request_data for k in ("question", "table_data", "title")):
        logger.error("Missing required fields in request")
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        # Extract data from request
        question_text = request_data["question"]
        table_data = request_data["table_data"]
        title = request_data["title"]
        include_debug = request_data.get("include_debug", False)
        
        logger.info(f"Processing question: '{question_text}'")
        logger.info(f"Table data length: {len(table_data) if table_data else 0}")
        logger.info(f"Title: {title}")
        
        # Check if table_data is valid
        if not table_data or len(table_data) < 10:  # Arbitrary minimum length check
            logger.error("Table data is missing or too short")
            return jsonify({"error": "Invalid table data. Please extract chart data first."}), 400
        
        # Check if Ollama is available
        ollama_running, models = check_ollama_status()
        if not ollama_running:
            logger.error("Ollama is not available")
            return jsonify({"error": "Ollama is not running. Please start Ollama service."}), 503
        
        # Use the model specified in the request or default to llama3
        model = request_data.get("model", "llama3")
        
        if model not in models and models:
            logger.warning(f"Model {model} not available, using {models[0]} instead")
            model = models[0]
            
        logger.info(f"Using model: {model}")
        
        # Get answer from the LLM
        answer = ask_local_llm(question_text, table_data, title, model)
        logger.info(f"Answer received from LLM: {answer[:100]}...")  # Log first 100 chars
        
        response_data = {"answer": answer}
        
        # Include debug info if requested
        if include_debug:
            response_data["debug_info"] = {
                "model_used": model,
                "table_data_length": len(table_data),
                "prompt_used": f"Table data + question about {title}"
            }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error processing question: {str(e)}")
        return jsonify({"error": str(e)}), 500

def retry_on_failure(max_retries=3, delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay} seconds...")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator

# Add conversation context tracking
conversation_contexts = {}

@app.route('/api/generate', methods=['POST'])
@retry_on_failure(max_retries=3, delay=2)
def generate():
    """Endpoint to generate data using Ollama"""
    try:
        data = request.get_json()
        if not data or 'input' not in data:
            return jsonify({"error": "Missing input data"}), 400

        # Get or create conversation context
        session_id = data.get('session_id', 'default')
        if session_id not in conversation_contexts:
            conversation_contexts[session_id] = []

        # Check if Ollama is available with increased timeout
        ollama_running, available_models = check_ollama_status()
        if not ollama_running:
            return jsonify({"error": "Ollama service is not available"}), 503

        # Use the first available model if none specified
        model = data.get('model', available_models[0] if available_models else 'llama3')
        
        # Build context-aware prompt
        context = "\n".join(conversation_contexts[session_id][-5:])  # Keep last 5 messages
        prompt = f"{context}\n\nUser: {data['input']}\nAssistant:"
        
        # Generate response using Ollama with increased timeout
        response = ask_local_llm(
            question=prompt,
            table_data="",  # Empty for now since we're not processing charts
            title="User Input",
            model=model
        )
        
        if isinstance(response, str) and response.startswith("Error:"):
            return jsonify({"error": response}), 500
            
        # Update conversation context
        conversation_contexts[session_id].append(f"User: {data['input']}")
        conversation_contexts[session_id].append(f"Assistant: {response}")
        
        # Limit context size
        if len(conversation_contexts[session_id]) > 10:  # Keep last 5 exchanges
            conversation_contexts[session_id] = conversation_contexts[session_id][-10:]
            
        return jsonify({"result": response}), 200
    except Exception as e:
        logger.error(f"Error in generate endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze-chart', methods=['POST'])
@retry_on_failure(max_retries=3, delay=2)
def analyze_chart():
    """Endpoint to analyze a chart image"""
    try:
        # Check if image file is included in the request
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
            
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400
            
        # Save the uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Get model from request or use default
        model = request.form.get('model', 'llama3')
        
        # Analyze the chart
        title, headers, data, formatted_table, table_str = extract_table_from_chart(filepath)
        
        # Clean up the uploaded file
        try:
            os.remove(filepath)
        except:
            pass
            
        return jsonify({
            "title": title,
            "headers": headers,
            "data": data,
            "formatted_table": formatted_table,
            "table_str": table_str
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing chart: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/ask-chart', methods=['POST'])
@retry_on_failure(max_retries=3, delay=2)
def ask_chart():
    """Endpoint to ask questions about chart data"""
    try:
        data = request.get_json()
        if not data or not all(k in data for k in ['question', 'table_data', 'title']):
            return jsonify({"error": "Missing required fields"}), 400
            
        # Get model from request or use default
        model = data.get('model', 'llama3')
        
        # Ask the question
        answer = ask_local_llm(
            question=data['question'],
            table_data=data['table_data'],
            title=data['title'],
            model=model
        )
        
        return jsonify({"answer": answer}), 200
        
    except Exception as e:
        logger.error(f"Error asking question: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
