from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from analyzer import analyze_code

app = Flask(__name__, static_folder='static')  # 指定静态文件夹
CORS(app)  # 仍然保留，方便独立部署

@app.route('/')
def index():
    """返回前端主页"""
    return send_from_directory('static', 'index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if not data or 'code' not in data:
        return jsonify({'error': 'Missing code'}), 400
    code = data['code']
    version = data.get('version', 'c++17')
    compiler = data.get('compiler', 'gcc')
    result = analyze_code(code, version, compiler)
    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)