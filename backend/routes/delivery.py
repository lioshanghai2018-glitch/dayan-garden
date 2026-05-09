from flask import Blueprint, request, jsonify, g
from datetime import datetime, time, timedelta

delivery_bp = Blueprint('delivery', __name__)


def get_user_id():
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


def get_delivery_date():
    """获取配送日期：根据是否超过22点决定是明天还是后天"""
    now = datetime.now()
    current_hour = now.hour
    if current_hour >= 22:
        # 22点后，送达日期为后天
        return (now + timedelta(days=2)).date()
    else:
        # 否则为明天
        return (now + timedelta(days=1)).date()


def get_delivery_date_display():
    """获取配送日期的显示文本"""
    delivery_date = get_delivery_date()
    weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][delivery_date.weekday()]
    return f"{delivery_date.month}月{delivery_date.day}日（{weekday}）"


@delivery_bp.route('/slots', methods=['GET'])
def get_slots():
    """获取可用配送时间段（次日达模式）"""
    from database import db, DeliverySlot
    slots = DeliverySlot.query.filter_by(status=1).order_by(DeliverySlot.start_time).all()
    delivery_date = get_delivery_date()
    delivery_date_display = get_delivery_date_display()

    return jsonify({'code': 200, 'data': {
        'delivery_date': delivery_date.strftime('%Y-%m-%d'),
        'delivery_date_display': delivery_date_display,
        'slots': [{
            'id': s.id,
            'name': s.name,
            'start_time': s.start_time.strftime('%H:%M') if s.start_time else '',
            'end_time': s.end_time.strftime('%H:%M') if s.end_time else '',
            'available': True  # 次日达全部可选
        } for s in slots]
    }})


@delivery_bp.route('/is_cutoff', methods=['GET'])
def is_cutoff():
    """查询是否已截单"""
    now = datetime.now()
    cutoff = now.hour >= 22
    return jsonify({'code': 200, 'data': {
        'cutoff': cutoff,
        'message': '今日已截单，下单后明天送达' if cutoff else ''
    }})


@delivery_bp.route('/track/<int:order_id>', methods=['GET'])
def track(order_id):
    """查询配送进度"""
    from database import db, Order, Delivery, User
    user_id = get_user_id()

    delivery = Delivery.query.filter_by(order_id=order_id).first()
    if not delivery:
        return jsonify({'code': 404, 'message': '配送信息不存在'}), 404

    order = Order.query.get(order_id)
    # 验证权限
    if user_id and order.user_id != user_id:
        # 如果是商家或骑手，放行
        if hasattr(g, 'current_user') and g.current_user.role in ['merchant', 'rider']:
            pass
        else:
            return jsonify({'code': 403, 'message': '无权查看'}), 403

    rider = User.query.get(delivery.rider_id) if delivery.rider_id else None

    # 构建配送时间线
    timeline = []
    if order.created_at:
        timeline.append({'time': order.created_at.strftime('%Y-%m-%d %H:%M'), 'status': '订单已创建', 'desc': '等待支付'})
    if order.pay_time:
        timeline.append({'time': order.pay_time.strftime('%Y-%m-%d %H:%M'), 'status': '支付成功', 'desc': '等待商家接单'})
    if delivery.pickup_time:
        timeline.append({'time': delivery.pickup_time.strftime('%Y-%m-%d %H:%M'), 'status': '已取货', 'desc': '骑手已从商家取货'})
    if delivery.delivery_time:
        timeline.append({'time': delivery.delivery_time.strftime('%Y-%m-%d %H:%M'), 'status': '配送中', 'desc': '正在配送途中'})
    if delivery.arrive_time:
        timeline.append({'time': delivery.arrive_time.strftime('%Y-%m-%d %H:%M'), 'status': '已到达', 'desc': '已到客户门口'})
    if delivery.complete_time:
        timeline.append({'time': delivery.complete_time.strftime('%Y-%m-%d %H:%M'), 'status': '已完成', 'desc': '订单已完成'})

    return jsonify({'code': 200, 'data': {
        'delivery_id': delivery.id,
        'order_id': delivery.order_id,
        'status': delivery.status,
        'rider': {
            'name': rider.nickname if rider else None,
            'phone': rider.phone if rider else None
        } if rider else None,
        'timeline': timeline
    }})


# ==================== 骑手端API ====================

@delivery_bp.route('/rider/orders', methods=['GET'])
def rider_orders():
    """获取骑手待配送订单"""
    from database import db, Order, Delivery, Address
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    # 获取该骑手的所有配送单
    deliveries = Delivery.query.filter_by(rider_id=rider_id).order_by(Delivery.created_at.desc()).all()

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
            'status': d.status,
            'total_amount': float(order.total_amount),
            'address': {
                'name': address.name if address else '',
                'phone': address.phone if address else '',
                'detail': f"{address.province if address else ''}{address.city if address else ''}{address.district if address else ''}{address.detail if address else ''}"
            } if address else None,
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'code': 200, 'data': result})


@delivery_bp.route('/rider/assign', methods=['POST'])
def assign_to_rider():
    """分配订单给骑手（商家操作）"""
    from database import db, Delivery, Order
    data = request.get_json()
    order_id = data.get('order_id')
    rider_id = data.get('rider_id')

    if not order_id or not rider_id:
        return jsonify({'code': 400, 'message': '参数不完整'}), 400

    delivery = Delivery.query.filter_by(order_id=order_id).first()
    if not delivery:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    delivery.rider_id = rider_id
    delivery.status = 1  # 待取货
    db.session.commit()

    # 更新订单状态
    order = Order.query.get(order_id)
    if order:
        order.status = 3  # 待取货
        db.session.commit()

    return jsonify({'code': 200, 'message': '分配成功'})


@delivery_bp.route('/rider/accept', methods=['POST'])
def accept_order():
    """骑手接单"""
    from database import db, Delivery, Order
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    delivery = Delivery.query.get(delivery_id)
    if not delivery:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.rider_id and delivery.rider_id != rider_id:
        return jsonify({'code': 400, 'message': '该单已被其他骑手接单'}), 400

    delivery.rider_id = rider_id
    delivery.status = 1
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 3
        db.session.commit()

    return jsonify({'code': 200, 'message': '接单成功'})


@delivery_bp.route('/rider/pickup', methods=['POST'])
def pickup():
    """确认取货（从商家）"""
    from database import db, Delivery, Order
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != rider_id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status != 1:
        return jsonify({'code': 400, 'message': '当前状态不允许取货'}), 400

    delivery.pickup_time = datetime.now()
    delivery.status = 2  # 取货中
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 4  # 配送中
        db.session.commit()

    return jsonify({'code': 200, 'message': '取货成功'})


@delivery_bp.route('/rider/deliver', methods=['POST'])
def start_deliver():
    """开始配送"""
    from database import db, Delivery
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != rider_id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status != 2:
        return jsonify({'code': 400, 'message': '当前状态不允许开始配送'}), 400

    delivery.delivery_time = datetime.now()
    delivery.status = 3
    db.session.commit()

    return jsonify({'code': 200, 'message': '开始配送'})


@delivery_bp.route('/rider/arrive', methods=['POST'])
def arrive():
    """到达客户门口"""
    from database import db, Delivery, Order
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != rider_id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status != 3:
        return jsonify({'code': 400, 'message': '当前状态不允许确认到达'}), 400

    delivery.arrive_time = datetime.now()
    delivery.status = 4
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 5  # 已到达
        db.session.commit()

    return jsonify({'code': 200, 'message': '已到达目的地'})


@delivery_bp.route('/rider/complete', methods=['POST'])
def complete():
    """确认送达"""
    from database import db, Delivery, Order
    rider_id = get_user_id()
    if not rider_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    delivery_id = data.get('delivery_id')

    delivery = Delivery.query.get(delivery_id)
    if not delivery or delivery.rider_id != rider_id:
        return jsonify({'code': 404, 'message': '配送单不存在'}), 404

    if delivery.status != 4:
        return jsonify({'code': 400, 'message': '当前状态不允许确认送达'}), 400

    delivery.complete_time = datetime.now()
    delivery.status = 5
    db.session.commit()

    order = Order.query.get(delivery.order_id)
    if order:
        order.status = 6  # 已完成
        db.session.commit()

    return jsonify({'code': 200, 'message': '配送完成，感谢您的辛苦付出！'})