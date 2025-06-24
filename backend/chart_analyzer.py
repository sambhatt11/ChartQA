
"""
Chart Analyzer module - Extracts tabular data from chart images and processes questions
using a locally running LLM via Ollama
"""

from transformers import Pix2StructProcessor, Pix2StructForConditionalGeneration
from PIL import Image
from tabulate import tabulate
import pandas as pd
import requests
import json
import signal
import sys
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
running = True

# Signal handler for graceful termination
def signal_handler(sig, frame):
    global running
    logger.info("\n\n⚠️ Shutdown requested. Finishing current operation...")
    running = False
    # Give time for any ongoing LLM request to complete
    time.sleep(1)
    logger.info("👋 Exiting gracefully. Goodbye!")
    sys.exit(0)

# Register the signal handler for Ctrl+C
signal.signal(signal.SIGINT, signal_handler)

def extract_table_from_chart(image_path):
    """
    Extract tabular data from a chart image
    
    Args:
        image_path (str): Path to the chart image
        
    Returns:
        tuple: (title, headers, data, formatted_table, table_str)
    """
    # Load model and processor
    logger.info("Loading Pix2Struct model and processor")
    processor = Pix2StructProcessor.from_pretrained('google/deplot')
    model = Pix2StructForConditionalGeneration.from_pretrained('google/deplot')
    
    # Load image
    logger.info(f"Processing image: {image_path}")
    image = Image.open(image_path)
    
    # Generate table data
    logger.info("Generating table data from image")
    inputs = processor(images=image, text="Generate underlying data table of the figure below:", return_tensors="pt")
    predictions = model.generate(**inputs, max_new_tokens=512)
    raw_output = processor.decode(predictions[0], skip_special_tokens=True)
    
    logger.debug(f"Raw output from model: {raw_output}")
    
    # Process the raw output into a list of lists for tabulation
    lines = raw_output.split('<0x0A>')
    headers = [] 
    data = []
    title = "Chart"  # Default title in case none is found
    
    # First pass: extract title and potential headers
    table_started = False
    for i, line in enumerate(lines):
        if '|' in line:
            table_started = True
            parts = [part.strip() for part in line.split('|') if part.strip()]
            if "TITLE" in line.upper() or i == 0:  # First line might be title
                title = parts[-1].strip() if parts else "Chart"
            elif not headers and table_started:
                # First line with pipe delimiters after title is likely header
                headers = parts
            else:
                # Only add non-empty rows
                if parts:
                    data.append(parts)
    
    # If we couldn't extract headers or data properly, try a different approach
    if not headers or not data:
        logger.info("Simple table extraction failed, trying alternative parsing method")
        try:
            # Try to find title in first line
            if lines and ":" in lines[0]:
                title = lines[0].split(":", 1)[1].strip()
            
            # Look for potential data rows (lines with numbers or categorical data)
            potential_data = []
            for line in lines:
                # Skip empty lines or title lines
                if not line.strip() or "TITLE" in line.upper():
                    continue
                    
                # Look for lines that might contain data
                parts = line.split()
                if len(parts) >= 2:
                    potential_data.append(parts)
            
            # If we found potential data, use it
            if potential_data:
                # First row might be headers
                if all(not part.replace('.', '').replace('%', '').isdigit() for part in potential_data[0]):
                    headers = potential_data[0]
                    data = potential_data[1:]
                else:
                    # Create generic headers
                    headers = [f"Column {i+1}" for i in range(len(potential_data[0]))]
                    data = potential_data
        except Exception as e:
            logger.warning(f"Alternative parsing failed: {str(e)}")
            # Create minimal fallback data
            if not headers:
                headers = ["Column 1"]
            if not data:
                data = [["No data extracted"]]
    
    # Ensure all rows have the same number of columns
    if data:
        max_cols = max(max(len(headers) if headers else 0, 1), max(len(row) for row in data))
        
        # Pad headers if needed
        if not headers:
            headers = [f"Column {i+1}" for i in range(max_cols)]
        else:
            headers = headers + [''] * (max_cols - len(headers))
        
        # Pad data rows if needed
        data = [row + [''] * (max_cols - len(row)) for row in data]
    else:
        # If no data was extracted, create a minimal table
        headers = ["Column 1"]
        data = [["No data extracted"]]
    
    # Format the table for display
    formatted_table = tabulate(data, headers=headers, tablefmt="grid")
    
    # Format the table for LLM input
    table_str = tabulate(data, headers=headers, tablefmt="pipe")
    
    # Log the raw text to help with debugging
    logger.info(f"Raw text from model: {raw_output[:200]}...")
    logger.info(f"Table data extraction complete - Title: {title}, Headers: {headers}, Rows: {len(data)}")
    
    return title, headers, data, formatted_table, raw_output


def ask_local_llm(question, table_data="", title="", model="llama3"):
    """Ask a question to the local LLM using Ollama"""
    try:
        # Check if the question is about colors or visual elements
        is_color_question = any(term in question.lower() for term in ["color", "colours", "visual", "appearance", "style", "design", "scheme"])
        
        # Prepare the prompt with enhanced instructions for visual analysis
        base_prompt = f"""Title: {title}
Data: {table_data}
Question: {question}
"""

        # Add specific instructions based on the question type
        if is_color_question:
            prompt = base_prompt + """
IMPORTANT: Your task is to analyze the visual elements of this chart, with special attention to colors. Please provide:
1. A detailed description of all colors used in the chart
2. What each color represents in the context of the data
3. How colors are used to distinguish between different data points, categories, or values
4. Any color patterns, gradients, or visual indicators of importance
5. How effectively the color scheme communicates the data

Focus primarily on the VISUAL APPEARANCE rather than just the numeric data."""
        else:
            prompt = base_prompt + """
Please provide a detailed answer based on the data and question above. When relevant, include observations about the visual elements of the chart, including colors and design."""

        # Make the request to Ollama with increased timeout
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": model,
                "prompt": prompt,
                "stream": False
            },
            timeout=420  # 7 minutes timeout
        )
        
        if response.status_code == 200:
            return response.json()['response']
        else:
            error_msg = f"Error from Ollama API: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return f"Error: {error_msg}"
            
    except requests.exceptions.Timeout:
        logger.error("Timeout while waiting for Ollama response")
        return "Error: Request timed out after 7 minutes. Please try again with a simpler question or a different model."
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Ollama: {str(e)}")
        return f"Error: {str(e)}"


def check_ollama_status():
    """Check if Ollama is running and get available models"""
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=30)  # Increased timeout
        if response.status_code == 200:
            models = [model['name'] for model in response.json()['models']]
            return True, models
        return False, []
    except requests.exceptions.RequestException as e:
        logger.error(f"Error checking Ollama status: {str(e)}")
        return False, []


def save_analysis(question, answer, filename="chart_analysis_results.txt"):
    """Save the Q&A to a file"""
    try:
        with open(filename, "a") as f:
            f.write(f"Q: {question}\n")
            f.write(f"A: {answer}\n\n")
        logger.info(f"Analysis saved to {filename}")
    except Exception as e:
        logger.error(f"Error saving analysis: {str(e)}")


def chart_analyzer(image_path, model="llama3"):
    """
    Main function to analyze a chart using local LLM
    
    Args:
        image_path (str): Path to the chart image
        model (str): The LLM model to use
    """
    global running
    
    # Check if Ollama is running
    ollama_running, available_models = check_ollama_status()
    if not ollama_running:
        logger.error("Ollama is not running. Please start it with 'ollama serve'")
        return
    
    if model not in available_models:
        logger.warning(f"Model '{model}' not found. Available models: {', '.join(available_models)}")
        if available_models:
            logger.info(f"Using {available_models[0]} instead.")
            model = available_models[0]
        else:
            logger.error("Please pull a model first with 'ollama pull llama3'")
            return
    
    logger.info("Extracting table from chart...")
    title, headers, data, formatted_table, raw_output = extract_table_from_chart(image_path)
    
    # Display the table
    logger.info(f"Table: {title}\n{formatted_table}")
    
    # Return the extracted data for API use
    return {
        "title": title,
        "headers": headers,
        "data": data,
        "formattedTable": formatted_table,
        "rawText": raw_output
    }
