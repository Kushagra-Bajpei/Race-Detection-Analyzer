from flask import Flask, render_template, request, jsonify
import fitz  # PyMuPDF
from analyzer import detect_race_conditions

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')


# FILE UPLOAD
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file received"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        if file.filename.endswith('.pdf'):
            text = extract_pdf_text(file)
        else:
            text = file.read().decode('utf-8')

        return jsonify({"code": text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def extract_pdf_text(file):
    doc = fitz.open(stream=file.read(), filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text


# ANALYZE
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    code = data.get('code', '')
    language = data.get('language', 'python')
    
    if not code:
        return jsonify({"error": "No code provided"}), 400
        
    result = detect_race_conditions(code, language)
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)