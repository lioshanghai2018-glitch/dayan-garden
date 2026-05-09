from flask import Blueprint, request, jsonify, g
from functools import wraps
from datetime import datetime, timedelta
import random

order_bp = Blueprint('order', __name__)


def generate_order_no():
    """生成唯一订单号"""
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))


def get_user_id():
    """从请求头或token获取用户ID"""
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


ORDER_STATUS = {
    0: '待支付',
    1: '待接单',
    2: '已接单',
    3: '待取货',
    4: '配送中',
    5: '已到达',
    6: '已完成',
    7: '已取消',
    8: '退款中',
    9: '已退款'
}


@order_bp.route('/create', methods=['POST'])
def create():
    from database import db, Order, OrderItem, Cart, Product, Address, Delivery, DeliverySlot
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    address_id = data.get('address_id')
    cart_ids = data.get('cart_ids', [])
    slot_id = data.get('slot_id')  # 配送时间段ID
    remark = data.get('remark', '')

    # 验证地址
    address = Address.query.get(address_id)
    if not address or address.user_id != user_id:
        return jsonify({'code': 400, 'message': '收货地址无效'}), 400

    # 获取购物车商品
    if cart_ids:
        carts = Cart.query.filter(Cart.id.in_(cart_ids), Cart.user_id == user_id).all()
    else:
        carts = Cart.query.filter_by(user_id=user_id).all()

    if not carts:
        return jsonify({'code': 400, 'message': '购物车为空'}), 400

    # 计算订单金额
    total_amount = 0
    order_items = []
    for cart in carts:
        product = Product.query.get(cart.product_id)
        if product and product.status == 1:
            if product.stock < cart.quantity:
                return jsonify({'code': 400, 'message': f'商品【{product.name}】库存不足'}), 400
            subtotal = float(product.price) * cart.quantity
            total_amount += subtotal
            order_items.append({
                'product_id': product.id,
                'name': product.name,
                'image': product.image,
                'price': float(product.price),
                'quantity': cart.quantity,
                'subtotal': subtotal
            })
            # 扣减库存
            product.stock -= cart.quantity

    if not order_items:
        return jsonify({'code': 400, 'message': '没有有效商品'}), 400

    # 创建订单
    order_no = generate_order_no()
    order = Order(
        order_no=order_no,
        user_id=user_id,
        address_id=address_id,
        total_amount=total_amount,
        pay_amount=total_amount,
        status=0,
        remark=remark
    )
    db.session.add(order)
    db.session.flush()

    # 创建订单明细
    for item in order_items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item['product_id'],
            product_name=item['name'],
            product_image=item['image'],
            price=item['price'],
            quantity=item['quantity'],
            subtotal=item['subtotal']
        )
        db.session.add(order_item)

    # 创建配送记录
    delivery = Delivery(
        order_id=order.id,
        delivery_slot_id=slot_id,
        status=0
    )
    db.session.add(delivery)

    # 清空购物车（只删除下单的商品）
    if cart_ids:
        Cart.query.filter(Cart.id.in_(cart_ids), Cart.user_id == user_id).delete(synchronize_session=False)
    else:
        Cart.query.filter_by(user_id=user_id).delete(synchronize_session=False)

    # 获取配送时段信息
    slot = DeliverySlot.query.get(slot_id)
    delivery_date_display = ''
    if slot:
        now = datetime.now()
        if now.hour >= 22:
            delivery_date = (now + timedelta(days=2)).date()
        else:
            delivery_date = (now + timedelta(days=1)).date()
        weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][delivery_date.weekday()]
        delivery_date_display = f"{delivery_date.month}月{delivery_date.day}日（{weekday}）{slot.name}"

    db.session.commit()

    return jsonify({
        'code': 200,
        'message': '订单创建成功',
        'data': {
            'order_id': order.id,
            'order_no': order_no,
            'total_amount': total_amount,
            'delivery_date_display': delivery_date_display
        }
    })


@order_bp.route('/list', methods=['GET'])
def list():
    from database import db, Order, OrderItem
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    status = request.args.get('status', type=int)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 10, type=int)

    query = Order.query.filter_by(user_id=user_id)
    if status is not None:
        query = query.filter_by(status=status)

    pagination = query.order_by(Order.created_at.desc()).paginate(page=page, per_page=page_size, error_out=False)

    orders = []
    for o in pagination.items:
        items = OrderItem.query.filter_by(order_id=o.id).all()
        orders.append({
            'id': o.id,
            'order_no': o.order_no,
            'total_amount': float(o.total_amount),
            'pay_amount': float(o.pay_amount),
            'status': o.status,
            'status_text': ORDER_STATUS.get(o.status, '未知'),
            'created_at': o.created_at.strftime('%Y-%m-%d %H:%M'),
            'item_count': len(items),
            'items': [{'name': i.product_name, 'quantity': i.quantity} for i in items[:3]]
        })

    return jsonify({
        'code': 200,
        'data': {
            'list': orders,
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page
        }
    })


@order_bp.route('/detail/<int:order_id>', methods=['GET'])
def detail(order_id):
    from database import db, Order, OrderItem, Address, Delivery, DeliverySlot, User
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    items = OrderItem.query.filter_by(order_id=order.id).all()
    address = Address.query.get(order.address_id)
    delivery = Delivery.query.filter_by(order_id=order.id).first()

    rider = None
    if delivery and delivery.rider_id:
        rider = User.query.get(delivery.rider_id)

    slot_name = None
    if delivery and delivery.delivery_slot_id:
        slot = DeliverySlot.query.get(delivery.delivery_slot_id)
        if slot:
            now = datetime.now()
            if now.hour >= 22:
                delivery_date = (now + timedelta(days=2)).date()
            else:
                delivery_date = (now + timedelta(days=1)).date()
            weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][delivery_date.weekday()]
            slot_name = f"{delivery_date.month}月{delivery_date.day}日（{weekday}）{slot.name}"

    return jsonify({'code': 200, 'data': {
        'id': order.id,
        'order_no': order.order_no,
        'total_amount': float(order.total_amount),
        'discount_amount': float(order.discount_amount or 0),
        'pay_amount': float(order.pay_amount),
        'pay_type': order.pay_type or 'simulate',
        'pay_time': order.pay_time.strftime('%Y-%m-%d %H:%M') if order.pay_time else None,
        'status': order.status,
        'status_text': ORDER_STATUS.get(order.status, '未知'),
        'remark': order.remark,
        'cancel_reason': order.cancel_reason,
        'created_at': order.created_at.strftime('%Y-%m-%d %H:%M'),
        'items': [{
            'product_id': i.product_id,
            'name': i.product_name,
            'image': i.product_image,
            'price': float(i.price),
            'quantity': i.quantity,
            'subtotal': float(i.subtotal)
        } for i in items],
        'address': {
            'name': address.name,
            'phone': address.phone,
            'community': address.community,
            'building': address.building,
            'room': address.room
        } if address else None,
        'delivery': {
            'status': delivery.status if delivery else 0,
            'rider_name': rider.nickname if rider else None,
            'rider_phone': rider.phone if rider else None,
            'slot_name': slot_name,
            'pickup_time': delivery.pickup_time.strftime('%Y-%m-%d %H:%M') if delivery.pickup_time else None,
            'delivery_time': delivery.delivery_time.strftime('%Y-%m-%d %H:%M') if delivery.delivery_time else None,
            'arrive_time': delivery.arrive_time.strftime('%Y-%m-%d %H:%M') if delivery.arrive_time else None
        } if delivery else None
    }})


@order_bp.route('/pay', methods=['POST'])
def pay():
    from database import db, Order, Delivery, User
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    order_id = data.get('order_id')

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    if order.status != 0:
        return jsonify({'code': 400, 'message': f'订单状态不允许支付，当前状态：{ORDER_STATUS.get(order.status)}'}), 400

    order.status = 1
    order.pay_time = datetime.now()
    order.pay_type = 'simulate'

    # 自动分配骑手
    online_riders = User.query.filter_by(role='rider', status=1).all()
    selected_rider = None
    if online_riders:
        # 找今日配送量最少的在线骑手
        min_count = float('inf')
        for rider in online_riders:
            today_start = datetime.combine(datetime.now().date(), datetime.min.time())
            count = Delivery.query.filter(
                Delivery.rider_id == rider.id,
                Delivery.status.in_([1, 2, 3, 4]),
                Delivery.created_at >= today_start
            ).count()
            if count < min_count:
                min_count = count
                selected_rider = rider

    # 更新或创建配送记录
    delivery = Delivery.query.filter_by(order_id=order.id).first()
    if not delivery:
        delivery = Delivery(order_id=order.id)
        db.session.add(delivery)
        db.session.flush()

    if selected_rider:
        delivery.rider_id = selected_rider.id
        delivery.status = 1  # 待取货
        order.status = 3  # 待取货

    db.session.commit()

    if selected_rider:
        return jsonify({'code': 200, 'message': f'支付成功，已自动分配骑手【{selected_rider.nickname}】'})
    else:
        return jsonify({'code': 200, 'message': '支付成功，暂无在线骑手'})


@order_bp.route('/cancel', methods=['POST'])
def cancel():
    from database import db, Order, Product, OrderItem
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    order_id = data.get('order_id')
    reason = data.get('reason', '')

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    # 待支付和待接单状态可以直接取消
    if order.status not in [0, 1]:
        return jsonify({'code': 400, 'message': f'当前状态无法取消：{ORDER_STATUS.get(order.status)}'}), 400

    order.status = 7
    order.cancel_reason = reason

    # 恢复库存
    items = OrderItem.query.filter_by(order_id=order.id).all()
    for item in items:
        product = Product.query.get(item.product_id)
        if product:
            product.stock += item.quantity

    db.session.commit()
    return jsonify({'code': 200, 'message': '订单已取消'})


@order_bp.route('/confirm', methods=['POST'])
def confirm():
    """确认收货"""
    from database import db, Order, Delivery
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    order_id = data.get('order_id')

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    # 只有配送中或已到达状态可以确认收货
    if order.status not in [4, 5]:
        return jsonify({'code': 400, 'message': f'当前状态无法确认收货：{ORDER_STATUS.get(order.status)}'}), 400

    order.status = 6

    delivery = Delivery.query.filter_by(order_id=order.id).first()
    if delivery:
        delivery.status = 5
        delivery.complete_time = datetime.now()

    db.session.commit()
    return jsonify({'code': 200, 'message': '确认收货成功'})


@order_bp.route('/delete', methods=['POST'])
def delete():
    """删除订单（只能删除已取消或已退款的订单）"""
    from database import db, Order
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    order_id = data.get('order_id')

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    # 只能删除已取消或已完成的订单
    if order.status not in [6, 7, 9]:
        return jsonify({'code': 400, 'message': '只能删除已取消或已完成的订单'}), 400

    db.session.delete(order)
    db.session.commit()
    return jsonify({'code': 200, 'message': '订单已删除'})


@order_bp.route('/refund', methods=['POST'])
def refund():
    """申请退款"""
    from database import db, Order, Product, OrderItem
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    order_id = data.get('order_id')
    reason = data.get('reason', '用户申请退款')

    order = Order.query.get(order_id)
    if not order or order.user_id != user_id:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    # 只有待支付、待接单、已接单状态可以申请退款
    if order.status not in [0, 1, 2]:
        return jsonify({'code': 400, 'message': f'当前状态无法申请退款：{ORDER_STATUS.get(order.status)}'}), 400

    order.status = 8  # 退款中
    order.cancel_reason = reason

    db.session.commit()
    return jsonify({'code': 200, 'message': '退款申请已提交'})