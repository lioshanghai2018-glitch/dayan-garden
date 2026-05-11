from datetime import datetime, time
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

    # 启动时自动初始化数据库
    with app.app_context():
        db.create_all()
        from database import User, Category, Product, DeliverySlot, Banner, Community, Supplier
        from datetime import time

        # 如果没有管理员，创建默认管理员
        if not User.query.filter_by(role='merchant').first():
            admin = User(openid='admin', nickname='管理员', role='merchant', status=1)
            db.session.add(admin)

        # 如果没有骑手，创建默认骑手
        if not User.query.filter_by(role='rider').first():
            rider = User(openid='rider', nickname='配送员', role='rider', status=1)
            db.session.add(rider)

        # 如果没有分类，创建默认分类
        if not Category.query.first():
            categories_data = [
                ('叶菜类', 1), ('根茎类', 2), ('瓜果类', 3),
                ('菌菇类', 4), ('豆制品', 5), ('其他', 6)
            ]
            category_ids = {}
            for name, sort in categories_data:
                cat = Category(name=name, sort_order=sort)
                db.session.add(cat)
                db.session.flush()
                category_ids[name] = cat.id

            # 创建示例商品
            products_data = [
                ('新鲜小白菜', '自家农场直供', 3.5, 4.5, '500g', 100, '叶菜类', '新鲜,有机'),
                ('菠菜', '富含铁元素', 4.0, 5.0, '500g', 80, '叶菜类', '新鲜'),
                ('胡萝卜', '橙红脆甜', 2.5, 3.0, '500g', 120, '根茎类', '新鲜'),
                ('土豆', '黄心土豆', 2.0, 2.5, '500g', 150, '根茎类', '新鲜'),
                ('番茄', '自然成熟', 4.5, 5.5, '500g', 90, '瓜果类', '新鲜'),
                ('黄瓜', '清脆爽口', 3.0, 3.8, '500g', 100, '瓜果类', '新鲜'),
                ('香菇', '香味浓郁', 8.0, 10.0, '300g', 60, '菌菇类', '新鲜'),
                ('金针菇', '洁白嫩滑', 5.0, 6.5, '300g', 70, '菌菇类', '新鲜'),
                ('嫩豆腐', '手工制作', 3.0, 3.5, '1盒', 80, '豆制品', '新鲜'),
                ('鸡蛋', '农家土鸡蛋', 12.0, 15.0, '10个', 50, '其他', '新鲜'),
            ]
            for name, subtitle, price, original_price, unit, stock, cat_name, tags in products_data:
                product = Product(
                    category_id=category_ids[cat_name],
                    name=name, subtitle=subtitle, price=price,
                    original_price=original_price, unit=unit,
                    stock=stock, tags=tags, status=1
                )
                db.session.add(product)

            # 创建配送时间段
            for name, start, end in [
                ('08:00-10:00（早间）', time(8,0), time(10,0)),
                ('11:00-13:00（午间）', time(11,0), time(13,0)),
                ('15:00-17:00（下午）', time(15,0), time(17,0)),
            ]:
                db.session.add(DeliverySlot(name=name, start_time=start, end_time=end, max_orders=20, status=1))

            # 创建轮播图
            for i, title in enumerate(['新鲜蔬菜 特惠促销', '农家直供 安全保障'], 1):
                db.session.add(Banner(title=title, image='https://img.yzcdn.cn/vant/cat.jpeg', sort_order=i, status=1))

            # 创建小区
            for name in ['象山市场小区', '古城花园', '四方广场小区', '幸福里小区', '阳光花园']:
                db.session.add(Community(name=name, status=1))

        db.session.commit()

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

        # 读取文件内容，转换为 base64 用于存储/传输
        import uuid
        import base64
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
        filename = uuid.uuid4().hex + '.' + ext
        file_path = os.path.join(upload_dir, filename)

        try:
            file.save(file_path)
            # 读取文件并转为 base64
            with open(file_path, 'rb') as f:
                file_data = base64.b64encode(f.read()).decode('utf-8')
            mime_type = f'image/{ext}' if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] else 'application/octet-stream'
            data_url = f'data:{mime_type};base64,{file_data}'
            return jsonify({'code': 200, 'data': {'url': data_url}})
        except Exception as e:
            # 如果文件操作失败，返回错误
            return jsonify({'code': 500, 'message': f'上传失败: {str(e)}'}), 500

    # 提供上传文件的访问（通过API路由读取文件）
    @app.route('/api/uploads/<path:filename>')
    def api_serve_upload(filename):
        file_path = os.path.join('static/uploads', filename)
        if os.path.exists(file_path):
            return send_from_directory('static/uploads', filename)
        return jsonify({'error': 'file not found'}), 404

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

    # 商家管理后台
    @app.route('/admin/')
    def admin_index():
        return send_from_directory('static/admin', 'index.html')

    @app.route('/admin/<path:filename>')
    def admin_static(filename):
        return send_from_directory('static/admin', filename)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)