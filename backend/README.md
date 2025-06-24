
# Chart Analysis Backend

This is the Flask backend for the Chart Whisperer application. It provides APIs to process chart images and answer questions about them using a local LLM via Ollama.

## Setup

1. Install the requirements:
```
pip install -r requirements.txt
```

2. Install and run Ollama:
- Download from [https://ollama.ai/](https://ollama.ai/)
- Start the Ollama service: `ollama serve`
- Pull a model: `ollama pull llama3`

3. Start the Flask backend:
```
python app.py
```

The server will run at `http://localhost:5000`.

## API Endpoints

- `GET /status` - Check if the backend is running
- `GET /models` - Get a list of available Ollama models
- `POST /extract` - Extract table data from a chart image
- `POST /question` - Ask a question about chart data

## Using the extract endpoint

Send a POST request with form-data containing an image file:
```
curl -X POST -F "image=@path/to/chart.png" http://localhost:5000/extract
```

## Using the question endpoint

Send a POST request with JSON data:
```
curl -X POST -H "Content-Type: application/json" -d '{"question":"What's the highest value?","table_data":"| Month | Revenue | Growth |\n| Jan | 1000 | 5% |\n| Feb | 1200 | 20% |","title":"Monthly Revenue"}' http://localhost:5000/question
```

## Requirements

- Python 3.8 or higher
- Transformers library
- Ollama running locally
- Sufficient RAM for model processing (at least 8GB recommended)
