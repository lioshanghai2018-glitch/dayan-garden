from flask import Blueprint, request, jsonify, g
from functools import wraps
import jwt
import os
from datetime import datetime, timedelta

rider_bp = Blueprint('rider', __name__)

SECRET_KEY = os.getenv('SECRET_KEY', 'dayan-vegetable-secret-key-2024')


def get_user_id():
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'code': 401, 'message': '请先登录'}), 401
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            from database import User
            user = User.query.get(payload['user_id'])
            if not user:
                return jsonify({'code': 401, 'message': '用户不存在'}), 401
            g.current_user = user
        except:
            return jsonify({'code': 401, 'message': '登录已过期'}), 401
        return f(*args, **kwargs)
    return decorated


def check_rider():
    """检查是否是骑手"""
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            from database import User
            user = User.query.get(payload['user_id'])
            if user and user.role == 'rider':
                g.current_user = user
                return user
        except:
            pass
    return None


# ==================== 骑手登录 ====================

@rider_bp.route('/login', methods=['POST'])
def login():
    """骑手登录"""
    from database import db, User
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'code': 400, 'message': '用户名和密码不能为空'}), 400

    # 查找骑手（支持用户名=手机号 或 openid=rider）
    user = None

    # 演示账号
    if username == 'rider' and password == 'rider123':
        user = User.query.filter_by(openid='rider', role='rider').first()
        if not user:
            user = User(
                openid='rider',
                nickname='演示骑手',
                phone='13800138000',
                role='rider',
                status=1
            )
            db.session.add(user)
            db.session.commit()

    # 根据手机号或openid查找骑手
    if not user:
        user = User.query.filter_by(phone=username, role='rider').first()
        if not user:
            user = User.query.filter_by(openid='rider_' + username, role='rider').first()

    if not user:
        return jsonify({'code': 401, 'message': '用户名或密码错误'}), 401

    # 验证密码（默认密码rider123，或者演示账号rider/rider123）
    if not (username == 'rider' and password == 'rider123'):
        # 非演示账号，验证密码是否正确
        # 目前骑手没有单独密码，用openid验证
        if user.openid != 'rider_' + username and user.openid != 'rider':
            return jsonify({'code': 401, 'message': '用户名或密码错误'}), 401

    token = jwt.encode({
        'user_id': user.id,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=7)
    }, SECRET_KEY, algorithm='HS256')

    return jsonify({
        'code': 200,
        'message': '登录成功',
        'data': {
            'token': token,
            'user': {
                'id': user.id,
                'nickname': user.nickname,
                'phone': user.phone,
                'role': user.role
            }
        }
    })


# ==================== 待配送订单 ====================

@rider_bp.route('/orders/pending', methods=['GET'])
@token_required
def pending_orders():
    """获取待取货的订单（status=1 待取货）"""
    from database import db, Delivery, Order, OrderItem, Address

    rider_id = g.current_user.id

    deliveries = Delivery.query.filter_by(
        rider_id=rider_id,
        status=1  # 待取货
    ).order_by(Delivery.created_at.asc()).all()

    result = []
    for d in deliveries:
        order = Order.query.get(d.order_id)
        if not order:
            continue
        address = Address.query.get(order.address_id)
        items = OrderItem.query.filter_by(order_id=order.id).all()

        # 构建商品摘要
        item_summary = '、'.join([f"{i.product_name}x{i.quantity}" for i in items[:3]])
        if len(items) > 3:
            item_summary += f' 等{len(items)}件'

        result.append({
            'delivery_id': d.id,
            'order_id': d.order_id,
            'order_no': order.order_no,
            'status': d.status,
            'total_amount': float(order.total_amount),
            'pay_amount': float(order.pay_amount),
            'items': [{'name': i.product_name, 'quantity': i.quantity} for i in items],
            'item_summary': item_summary,
            'address': {
                'name': address.name if address else '',
                'phone': address.phone if address else '',
                'detail': f"{address.community or ''} {address.building or ''} {address.room or ''}".strip()
            } if address else None,
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'code': 200, 'data': result})


# ==================== 配送中订单 ====================

@rider_bp.route('/orders/delivering', methods=['GET'])
@token_required
def delivering_orders():
    """获取正在配送的订单（status=2,3,4）"""
    from database import db, Delivery, Order, OrderItem, Address

    rider_id = g.current_user.id

    # status 2=取货中, 3=配送中, 4=已到达
    deliveries = Delivery.query.filter(
        Delivery.rider_id == rider_id,
        Delivery.status.in_([2, 3, 4])
    ).order_by(Delivery.created_at.asc()).all()

    result = []
    for d in deliveries:
        order = Order.query.get(d.order_id)
        if not order:
            continue
        address = Address.query.get(order.address_id)
        items = OrderItem.query.filter_by(order_id=order.id).all()

        item_summary = '、'.join([f"{i.product_name}x{i.quantity}" for i in items[:3]])
        if len(items) > 3:
            item_summary += f' 等{len(items)}件'

        status_text = {2: '取货中', 3: '配送中', 4: '已到达'}.get(d.status, '')

        result.append({
            'delivery_id': d.id,
            'order_id': d.order_id,
            'order_no': order.order_no,
            'status': d.status,
            'status_text': status_text,
            'total_amount': float(order.total_amount),
            'pay_amount': float(order.pay_amount),
            'items': [{'name': i.product_name, 'quantity': i.quantity} for i in items],
            'item_summary': item_summary,
            'address': {
                'name': address.name if address else '',
                'phone': address.phone if address else '',
                'detail': f"{address.community or ''} {address.building or ''} {address.room or ''}".strip()
            } if address else None,
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'code': 200, 'data': result})


# ==================== 开始配送 ====================

@rider_bp.route('/order/start', methods=['POST'])
@token_required
def start_delivery():
    """开始配送（status 1→3）"""
    from database import db, Delivery, Order

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    if not delivery_id:
        return jsonify({'code': 400, 'message': '缺少delivery_id'}), 400

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != g.current_user.id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status not in [1, 2]:
        return jsonify({'code': 400, 'message': '当前状态不允许开始配送'}), 400

    delivery.delivery_time = datetime.now()
    delivery.status = 3  # 配送中
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 4  # 配送中
        db.session.commit()

    return jsonify({'code': 200, 'message': '开始配送'})


# ==================== 已到达 ====================

@rider_bp.route('/order/arrive', methods=['POST'])
@token_required
def arrive_delivery():
    """确认到达（status 3→4）"""
    from database import db, Delivery, Order

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    if not delivery_id:
        return jsonify({'code': 400, 'message': '缺少delivery_id'}), 400

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != g.current_user.id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status not in [3]:
        return jsonify({'code': 400, 'message': '当前状态不允许确认到达'}), 400

    delivery.arrive_time = datetime.now()
    delivery.status = 4  # 已到达
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 5  # 已到达
        db.session.commit()

    return jsonify({'code': 200, 'message': '已到达目的地'})


# ==================== 确认送达 ====================

@rider_bp.route('/order/complete', methods=['POST'])
@token_required
def complete_delivery():
    """确认送达（status 3/4→5 完成）"""
    from database import db, Delivery, Order

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    if not delivery_id:
        return jsonify({'code': 400, 'message': '缺少delivery_id'}), 400

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != g.current_user.id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status not in [3, 4]:
        return jsonify({'code': 400, 'message': '当前状态不允许确认送达'}), 400

    delivery.complete_time = datetime.now()
    delivery.status = 5
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 6
        db.session.commit()

    return jsonify({'code': 200, 'message': '配送完成'})


# ==================== 历史记录 ====================

@rider_bp.route('/orders/history', methods=['GET'])
@token_required
def history_orders():
    """获取已完成的历史订单"""
    from database import db, Delivery, Order, Address

    rider_id = g.current_user.id

    deliveries = Delivery.query.filter_by(
        rider_id=rider_id,
        status=5  # 已完成
    ).order_by(Delivery.complete_time.desc()).limit(50).all()

    result = []
    for d in deliveries:
        order = Order.query.get(d.order_id)
        if not order:
            continue
        address = Address.query.get(order.address_id)

        result.append({
            'delivery_id': d.id,
            'order_id': d.order_id,
            'order_no': order.order_no,
            'total_amount': float(order.total_amount),
            'address': {
                'name': address.name if address else '',
                'detail': f"{address.community or ''} {address.building or ''} {address.room or ''}".strip()
            } if address else None,
            'complete_time': d.complete_time.strftime('%Y-%m-%d %H:%M') if d.complete_time else ''
        })

    return jsonify({'code': 200, 'data': result})


# ==================== 骑手统计 ====================

@rider_bp.route('/stats', methods=['GET'])
@token_required
def rider_stats():
    """获取骑手统计数据"""
    from database import db, Delivery

    rider_id = g.current_user.id

    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    # 今日完成
    today_start = datetime.combine(today, datetime.min.time())
    today_count = Delivery.query.filter(
        Delivery.rider_id == rider_id,
        Delivery.status == 5,
        Delivery.complete_time >= today_start
    ).count()

    # 本周完成
    week_start = datetime.combine(week_ago, datetime.min.time())
    week_count = Delivery.query.filter(
        Delivery.rider_id == rider_id,
        Delivery.status == 5,
        Delivery.complete_time >= week_start
    ).count()

    return jsonify({'code': 200, 'data': {
        'today_count': today_count,
        'week_count': week_count
    }})