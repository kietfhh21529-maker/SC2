from pathlib import Path
import json
import os
import re

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google import genai

APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / ".gitignore" / "config.json"

from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = APP_DIR.parent / "FrontEnd"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path=""
)
CORS(app)

VALID_LEVELS = ["Thấp", "Trung bình", "Cao", "Nghiêm trọng"]


def load_config():
    if not CONFIG_PATH.exists():
        return {}

    with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def load_api_key():
    config = load_config()

    return (
        os.environ.get("GEMINI_API_KEY")
        or config.get("GEMINI_API_KEY")
    )


api_key = load_api_key()

if not api_key:
    print("CẢNH BÁO: Chưa đọc được GEMINI_API_KEY")
else:
    print("Đã đọc được GEMINI_API_KEY")

client = genai.Client(api_key=api_key)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({
            "error": "Bạn chưa nhập tin nhắn cần kiểm tra. Hãy dán một tin nhắn rồi thử lại nhé."
        }), 400

    if len(message) > 5000:
        return jsonify({
            "error": "Tin nhắn quá dài. Bạn hãy rút gọn dưới 5000 ký tự rồi phân tích lại nhé."
        }), 400

    if not api_key:
        return jsonify({
            "error": "Ứng dụng chưa có API key. Hãy kiểm tra file .gitignore/config.json rồi chạy lại app nhé."
        }), 500

    prompt = f"""
Bạn là chuyên gia phát hiện tin nhắn lừa đảo, giải thích dễ hiểu cho người lớn tuổi 45+.

Hãy phân tích tin nhắn sau:
\"\"\"{message}\"\"\"

Chỉ trả về JSON hợp lệ, không markdown, không giải thích thêm.

JSON bắt buộc có đúng các khóa sau:
{{
  "level": "Thấp",
  "description": "Kết luận ngắn gọn, dễ hiểu",
  "signs": ["dấu hiệu 1", "dấu hiệu 2", "dấu hiệu 3"],
  "suspicious_quote": "đoạn đáng ngờ nhất trong tin nhắn, nếu không có thì ghi: Không có đoạn nào đáng ngờ.",
  "actions": ["hành động 1", "hành động 2", "hành động 3"],
  "counselor": "lời khuyên nhẹ nhàng của Cô tâm lý"
}}

Quy ước mức độ:
- Thấp: chưa có dấu hiệu nguy hiểm rõ ràng.
- Trung bình: có vài dấu hiệu đáng ngờ.
- Cao: nhiều dấu hiệu lừa đảo, nguy cơ mất tiền/thông tin cao.
- Nghiêm trọng: yêu cầu OTP, mật khẩu, chuyển tiền, thông tin ngân hàng/CCCD hoặc giả mạo cơ quan chức năng.

Giá trị của "level" chỉ được là một trong bốn giá trị:
"Thấp", "Trung bình", "Cao", "Nghiêm trọng".
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        raw_text = response.text or ""

        if not raw_text.strip():
            return jsonify({
                "error": "AI từ chối hoặc không thể phân tích nội dung này. Bạn hãy thử viết lại tin nhắn ngắn gọn hơn nhé."
            }), 403

        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```json", "", cleaned, flags=re.MULTILINE).strip()
        cleaned = re.sub(r"^```", "", cleaned, flags=re.MULTILINE).strip()
        cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            cleaned = match.group(0)

        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            result = {}

        if not isinstance(result, dict):
            result = {}

        level = result.get("level", "Trung bình")
        if level not in VALID_LEVELS:
            level = "Trung bình"

        signs = result.get("signs")
        if not isinstance(signs, list) or len(signs) == 0:
            signs = ["Có nội dung cần được kiểm tra thêm trước khi làm theo."]

        actions = result.get("actions")
        if not isinstance(actions, list) or len(actions) == 0:
            actions = [
                "Không cung cấp OTP, mật khẩu hoặc thông tin cá nhân.",
                "Không chuyển tiền khi chưa xác minh rõ nguồn gửi.",
                "Liên hệ kênh chính thức của ngân hàng hoặc cơ quan liên quan để kiểm tra."
            ]

        safe_result = {
            "level": level,
            "description": result.get(
                "description",
                "AI đã hoàn tất phân tích tin nhắn này."
            ),
            "signs": signs,
            "suspicious_quote": result.get(
                "suspicious_quote",
                message[:180] if level != "Thấp" else "Không có đoạn nào đáng ngờ."
            ),
            "actions": actions,
            "counselor": result.get(
                "counselor",
                "Hãy bình tĩnh, không vội làm theo tin nhắn. Nếu thấy nghi ngờ, hãy hỏi người thân hoặc liên hệ kênh chính thức để kiểm tra lại."
            )
        }

        return jsonify(safe_result)

    except Exception as e:
        error_text = str(e).lower()

        if (
            "safety" in error_text
            or "blocked" in error_text
            or "refuse" in error_text
            or "finish_reason" in error_text
        ):
            return jsonify({
                "error": "AI từ chối phân tích nội dung này. Bạn hãy thử viết lại tin nhắn ngắn gọn hơn nhé."
            }), 403

        return jsonify({
            "error": f"Hệ thống đang gặp sự cố khi gọi AI: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
