from datetime import datetime
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from config import Config
from database import db
import os


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)

    # 注册蓝图
    from routes.auth import auth_bp
    from routes.product import product_bp
    from routes.cart import cart_bp
    from routes.order import order_bp
    from routes.delivery import delivery_bp
    from routes.admin import admin_bp
    from routes.address import address_bp
    from routes.rider import rider_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(product_bp, url_prefix='/api/product')
    app.register_blueprint(cart_bp, url_prefix='/api/cart')
    app.register_blueprint(order_bp, url_prefix='/api/order')
    app.register_blueprint(delivery_bp, url_prefix='/api/delivery')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(address_bp, url_prefix='/api/address')
    app.register_blueprint(rider_bp, url_prefix='/api/rider')

    # 确保上传目录存在
    upload_dir = os.path.join('static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # 图片上传接口
    @app.route('/api/upload/image', methods=['POST'])
    def upload_image():
        if 'image' not in request.files:
            return jsonify({'code': 400, 'message': '没有上传文件'}), 400
        file = request.files['image']
        if file.filename == '':
            return jsonify({'code': 400, 'message': '没有选择文件'}), 400
        import uuid
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
        filename = uuid.uuid4().hex + '.' + ext
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        return jsonify({'code': 200, 'data': {'url': '/uploads/' + filename}})

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': '大研菜园 API 运行中'}

    # 骑手端H5页面
    @app.route('/rider/')
    def rider_index():
        return send_from_directory('static/rider', 'index.html')

    @app.route('/rider/<path:filename>')
    def rider_static(filename):
        return send_from_directory('static/rider', filename)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)