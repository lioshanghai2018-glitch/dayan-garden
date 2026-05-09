from flask import Blueprint, request, jsonify, g
from functools import wraps
import jwt
import os

admin_bp = Blueprint('admin', __name__)

SECRET_KEY = os.getenv('SECRET_KEY', 'dayan-vegetable-secret-key-2024')

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


def get_user_id():
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


def check_admin():
    """检查是否是商家管理员"""
    # 先尝试从token验证
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            from database import User
            user = User.query.get(payload['user_id'])
            if user and user.role == 'merchant':
                g.current_user = user
                return user
        except:
            pass

    # 再尝试X-User-ID
    user_id = get_user_id()
    if not user_id:
        return None
    from database import User
    user = User.query.get(user_id)
    if not user or user.role != 'merchant':
        return None
    return user


# ==================== 商品管理 ====================

@admin_bp.route('/product/list', methods=['GET'])
def product_list():
    """获取商品列表（管理端）"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Product, Category
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    status = request.args.get('status', type=int)
    category_id = request.args.get('category_id', type=int)

    query = Product.query
    if status is not None:
        query = query.filter_by(status=status)
    if category_id:
        query = query.filter_by(category_id=category_id)

    pagination = query.order_by(Product.id.desc()).paginate(page=page, per_page=page_size, error_out=False)

    products = []
    for p in pagination.items:
        category = Category.query.get(p.category_id) if p.category_id else None
        products.append({
            'id': p.id,
            'name': p.name,
            'category_id': p.category_id,
            'category_name': category.name if category else '',
            'price': float(p.price),
            'original_price': float(p.original_price) if p.original_price else None,
            'unit': p.unit,
            'stock': p.stock,
            'image': p.image,
            'status': p.status,
            'created_at': p.created_at.strftime('%Y-%m-%d')
        })

    return jsonify({'code': 200, 'data': {
        'list': products,
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page
    }})


@admin_bp.route('/product/create', methods=['POST'])
def product_create():
    """创建商品"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Product
    data = request.get_json()

    if not data.get('name') or not data.get('price'):
        return jsonify({'code': 400, 'message': '商品名称和价格不能为空'}), 400

    product = Product(
        category_id=data.get('category_id'),
        name=data.get('name'),
        subtitle=data.get('subtitle', ''),
        price=data.get('price'),
        original_price=data.get('original_price'),
        unit=data.get('unit', '500g'),
        stock=data.get('stock', 0),
        image=data.get('image', ''),
        images=','.join(data.get('images', [])) if data.get('images') else '',
        description=data.get('description', ''),
        tags=','.join(data.get('tags', [])) if data.get('tags') else '',
        sort_order=data.get('sort_order', 0),
        status=data.get('status', 1)
    )
    db.session.add(product)
    db.session.commit()

    return jsonify({'code': 200, 'message': '创建成功', 'data': {'id': product.id}})


@admin_bp.route('/product/update', methods=['POST'])
def product_update():
    """更新商品"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Product
    data = request.get_json()
    product_id = data.get('id')

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'code': 404, 'message': '商品不存在'}), 404

    if 'name' in data:
        product.name = data['name']
    if 'subtitle' in data:
        product.subtitle = data['subtitle']
    if 'category_id' in data:
        product.category_id = data['category_id']
    if 'price' in data:
        product.price = data['price']
    if 'original_price' in data:
        product.original_price = data['original_price']
    if 'unit' in data:
        product.unit = data['unit']
    if 'stock' in data:
        product.stock = data['stock']
    if 'image' in data:
        product.image = data['image']
    if 'images' in data:
        product.images = ','.join(data['images']) if data['images'] else ''
    if 'description' in data:
        product.description = data['description']
    if 'tags' in data:
        product.tags = ','.join(data['tags']) if data['tags'] else ''
    if 'sort_order' in data:
        product.sort_order = data['sort_order']
    if 'status' in data:
        product.status = data['status']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@admin_bp.route('/product/delete', methods=['POST'])
def product_delete():
    """删除商品（下架）"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Product
    data = request.get_json()
    product_id = data.get('id')

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'code': 404, 'message': '商品不存在'}), 404

    product.status = 0
    db.session.commit()
    return jsonify({'code': 200, 'message': '删除成功'})


# ==================== 订单管理 ====================

@admin_bp.route('/order/list', methods=['GET'])
def order_list():
    """获取订单列表（管理端）"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order, User, OrderItem
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    status = request.args.get('status', type=int)

    query = Order.query
    if status is not None:
        query = query.filter_by(status=status)

    pagination = query.order_by(Order.created_at.desc()).paginate(page=page, per_page=page_size, error_out=False)

    orders = []
    for o in pagination.items:
        user = User.query.get(o.user_id)
        item_count = OrderItem.query.filter_by(order_id=o.id).count()
        orders.append({
            'id': o.id,
            'order_no': o.order_no,
            'user_nickname': user.nickname if user else '未知用户',
            'total_amount': float(o.total_amount),
            'pay_amount': float(o.pay_amount),
            'status': o.status,
            'created_at': o.created_at.strftime('%Y-%m-%d %H:%M'),
            'item_count': item_count
        })

    return jsonify({'code': 200, 'data': {
        'list': orders,
        'total': pagination.total,
        'pages': pagination.pages
    }})


@admin_bp.route('/order/detail/<int:order_id>', methods=['GET'])
def order_detail(order_id):
    """获取订单详情（管理端）"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order, User, OrderItem, Address, Delivery
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    user = User.query.get(order.user_id)
    items = OrderItem.query.filter_by(order_id=order.id).all()
    address = Address.query.get(order.address_id)
    delivery = Delivery.query.filter_by(order_id=order.id).first()
    rider = User.query.get(delivery.rider_id) if delivery and delivery.rider_id else None

    return jsonify({'code': 200, 'data': {
        'id': order.id,
        'order_no': order.order_no,
        'user': {'id': user.id, 'nickname': user.nickname, 'phone': user.phone} if user else None,
        'items': [{'name': i.product_name, 'price': float(i.price), 'quantity': i.quantity, 'subtotal': float(i.subtotal)} for i in items],
        'address': {'name': address.name, 'phone': address.phone, 'detail': f"{address.community} {address.building} {address.room}"} if address else None,
        'total_amount': float(order.total_amount),
        'pay_amount': float(order.pay_amount),
        'status': order.status,
        'created_at': order.created_at.strftime('%Y-%m-%d %H:%M'),
        'delivery': {
            'id': delivery.id if delivery else None,
            'rider': {'id': rider.id, 'nickname': rider.nickname, 'phone': rider.phone} if rider else None,
            'status': delivery.status if delivery else None
        } if delivery else None
    }})


@admin_bp.route('/order/accept', methods=['POST'])
def order_accept():
    """商家接单并自动分配骑手"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order, Delivery, User
    data = request.get_json()
    order_id = data.get('order_id')

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    if order.status != 1:
        return jsonify({'code': 400, 'message': '订单状态不允许接单'}), 400

    # 接单后自动分配给在线骑手（最简单的自动分配规则）
    # 找一个今日配送量最少的在线骑手
    online_riders = User.query.filter_by(role='rider', status=1).all()
    selected_rider = None
    min_deliveries = float('inf')

    for rider in online_riders:
        today_start = datetime.combine(datetime.now().date(), datetime.min.time())
        today_count = Delivery.query.filter(
            Delivery.rider_id == rider.id,
            Delivery.status.in_([2, 3, 4]),  # 取货中、配送中、已到达
            Delivery.created_at >= today_start
        ).count()
        if today_count < min_deliveries:
            min_deliveries = today_count
            selected_rider = rider

    # 更新订单状态为已接单
    order.status = 2
    db.session.flush()

    # 如果找到骑手，分配配送任务
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
        return jsonify({'code': 200, 'message': f'接单成功，已分配给骑手【{selected_rider.nickname}】'})
    else:
        return jsonify({'code': 200, 'message': '接单成功，暂无在线骑手'})


@admin_bp.route('/order/pay', methods=['POST'])
def admin_pay():
    """管理员标记订单已支付"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order
    from datetime import datetime
    data = request.get_json()
    order_id = data.get('order_id')

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'code': 404, 'message': '订单不存在'}), 404

    if order.status != 0:
        return jsonify({'code': 400, 'message': f'订单状态不允许支付，当前状态：{ORDER_STATUS.get(order.status)}'}), 400

    order.status = 1
    order.pay_time = datetime.now()
    order.pay_type = 'simulate'
    db.session.commit()

    return jsonify({'code': 200, 'message': '已标记为已支付'})


@admin_bp.route('/order/cancel', methods=['POST'])
def admin_cancel():
    """管理员取消订单"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order, Product, OrderItem
    data = request.get_json()
    order_id = data.get('order_id')
    reason = data.get('reason', '商家取消')

    order = Order.query.get(order_id)
    if not order:
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


# ==================== 配送管理 ====================

@admin_bp.route('/delivery/assign', methods=['POST'])
def assign_rider():
    """分配骑手"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Delivery, Order
    data = request.get_json()
    order_id = data.get('order_id')
    rider_id = data.get('rider_id')

    if not order_id or not rider_id:
        return jsonify({'code': 400, 'message': '参数不完整'}), 400

    delivery = Delivery.query.filter_by(order_id=order_id).first()
    if not delivery:
        delivery = Delivery(order_id=order_id)
        db.session.add(delivery)
        db.session.flush()

    delivery.rider_id = rider_id
    delivery.status = 1
    db.session.commit()

    order = Order.query.get(order_id)
    if order:
        order.status = 3
        db.session.commit()

    return jsonify({'code': 200, 'message': '分配成功'})


@admin_bp.route('/delivery/slots', methods=['GET'])
def delivery_slots():
    """获取配送时间段"""
    from database import db, DeliverySlot
    slots = DeliverySlot.query.all()
    return jsonify({'code': 200, 'data': [
        {'id': s.id, 'name': s.name, 'start_time': s.start_time.strftime('%H:%M') if s.start_time else '', 'end_time': s.end_time.strftime('%H:%M') if s.end_time else '', 'max_orders': s.max_orders, 'current_orders': s.current_orders, 'status': s.status}
        for s in slots
    ]})


@admin_bp.route('/delivery/slot/create', methods=['POST'])
def slot_create():
    """创建配送时间段"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, DeliverySlot
    from datetime import time
    data = request.get_json()

    name = data.get('name')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    if not name or not start_time_str or not end_time_str:
        return jsonify({'code': 400, 'message': '时间段名称、开始时间、结束时间不能为空'}), 400

    # 解析时间
    start_parts = start_time_str.split(':')
    end_parts = end_time_str.split(':')
    start_time = time(int(start_parts[0]), int(start_parts[1]))
    end_time = time(int(end_parts[0]), int(end_parts[1]))

    slot = DeliverySlot(
        name=name,
        start_time=start_time,
        end_time=end_time,
        max_orders=data.get('max_orders', 50),
        status=data.get('status', 1)
    )
    db.session.add(slot)
    db.session.commit()
    return jsonify({'code': 200, 'message': '创建成功', 'data': {'id': slot.id}})


@admin_bp.route('/delivery/slot/update', methods=['POST'])
def slot_update():
    """更新配送时间段"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, DeliverySlot
    from datetime import time
    data = request.get_json()

    slot_id = data.get('id')
    slot = DeliverySlot.query.get(slot_id)
    if not slot:
        return jsonify({'code': 404, 'message': '时间段不存在'}), 404

    if 'name' in data:
        slot.name = data['name']
    if 'start_time' in data:
        parts = data['start_time'].split(':')
        slot.start_time = time(int(parts[0]), int(parts[1]))
    if 'end_time' in data:
        parts = data['end_time'].split(':')
        slot.end_time = time(int(parts[0]), int(parts[1]))
    if 'max_orders' in data:
        slot.max_orders = data['max_orders']
    if 'status' in data:
        slot.status = data['status']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@admin_bp.route('/delivery/slot/delete', methods=['POST'])
def slot_delete():
    """删除配送时间段"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, DeliverySlot
    data = request.get_json()
    slot_id = data.get('id')

    slot = DeliverySlot.query.get(slot_id)
    if not slot:
        return jsonify({'code': 404, 'message': '时间段不存在'}), 404

    db.session.delete(slot)
    db.session.commit()
    return jsonify({'code': 200, 'message': '删除成功'})


# ==================== 骑手管理 ====================

@admin_bp.route('/rider/list', methods=['GET'])
def rider_list():
    """获取骑手列表"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, User, Delivery
    from datetime import datetime, timedelta

    today = datetime.now().date()
    riders = User.query.filter_by(role='rider').all()

    result = []
    for r in riders:
        # 计算今日配送量
        today_start = datetime.combine(today, datetime.min.time())
        today_deliveries = Delivery.query.filter(
            Delivery.rider_id == r.id,
            Delivery.complete_time >= today_start
        ).count()

        result.append({
            'id': r.id,
            'nickname': r.nickname,
            'phone': r.phone,
            'status': r.status,
            'today_deliveries': today_deliveries
        })

    return jsonify({'code': 200, 'data': result})


@admin_bp.route('/rider/create', methods=['POST'])
def rider_create():
    """添加骑手"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, User
    data = request.get_json()
    nickname = data.get('nickname')
    phone = data.get('phone')
    password = data.get('password', 'rider123')  # 默认密码rider123

    if not nickname or not phone:
        return jsonify({'code': 400, 'message': '姓名和手机号不能为空'}), 400

    # 检查手机号是否已存在
    existing = User.query.filter_by(phone=phone, role='rider').first()
    if existing:
        return jsonify({'code': 400, 'message': '该手机号已被使用'}), 400

    rider = User(
        openid='rider_' + phone,  # 用于登录验证
        nickname=nickname,
        phone=phone,
        role='rider',
        status=1
    )
    db.session.add(rider)
    db.session.commit()

    return jsonify({'code': 200, 'message': '添加成功', 'data': {'id': rider.id, 'password': password}})


@admin_bp.route('/rider/update', methods=['POST'])
def rider_update():
    """更新骑手信息"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, User
    data = request.get_json()
    rider_id = data.get('id')

    rider = User.query.get(rider_id)
    if not rider or rider.role != 'rider':
        return jsonify({'code': 404, 'message': '骑手不存在'}), 404

    if 'nickname' in data:
        rider.nickname = data['nickname']
    if 'phone' in data:
        # 检查新手机号是否被其他骑手使用
        if data['phone'] != rider.phone:
            existing = User.query.filter_by(phone=data['phone'], role='rider').first()
            if existing:
                return jsonify({'code': 400, 'message': '该手机号已被使用'}), 400
            rider.phone = data['phone']
            rider.openid = 'rider_' + data['phone']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@admin_bp.route('/rider/toggle', methods=['POST'])
def rider_toggle():
    """切换骑手状态"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, User
    data = request.get_json()
    rider_id = data.get('id')

    rider = User.query.get(rider_id)
    if not rider or rider.role != 'rider':
        return jsonify({'code': 404, 'message': '骑手不存在'}), 404

    rider.status = 0 if rider.status == 1 else 1
    db.session.commit()

    return jsonify({'code': 200, 'message': '状态已切换'})


@admin_bp.route('/rider/delete', methods=['POST'])
def rider_delete():
    """删除骑手"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, User
    data = request.get_json()
    rider_id = data.get('id')

    rider = User.query.get(rider_id)
    if not rider or rider.role != 'rider':
        return jsonify({'code': 404, 'message': '骑手不存在'}), 404

    # 软删除：设置为无效状态
    rider.status = 0
    db.session.commit()

    return jsonify({'code': 200, 'message': '删除成功'})


# ==================== 分类管理 ====================

@admin_bp.route('/category/list', methods=['GET'])
def category_list():
    """获取分类列表（管理端）"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Category
    categories = Category.query.all()
    return jsonify({'code': 200, 'data': [
        {'id': c.id, 'name': c.name, 'icon': c.icon, 'sort_order': c.sort_order, 'status': c.status}
        for c in categories
    ]})


@admin_bp.route('/category/create', methods=['POST'])
def category_create():
    """创建分类"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Category
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'code': 400, 'message': '分类名称不能为空'}), 400

    category = Category(
        name=name,
        icon=data.get('icon', ''),
        sort_order=data.get('sort_order', 0)
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({'code': 200, 'message': '创建成功', 'data': {'id': category.id}})


@admin_bp.route('/category/update', methods=['POST'])
def category_update():
    """更新分类"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Category
    data = request.get_json()
    category_id = data.get('id')

    category = Category.query.get(category_id)
    if not category:
        return jsonify({'code': 404, 'message': '分类不存在'}), 404

    if 'name' in data:
        category.name = data['name']
    if 'icon' in data:
        category.icon = data['icon']
    if 'sort_order' in data:
        category.sort_order = data['sort_order']
    if 'status' in data:
        category.status = data['status']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


# ==================== 轮播图管理 ====================

@admin_bp.route('/banner/list', methods=['GET'])
def banner_list():
    """获取轮播图列表"""
    from database import db, Banner
    banners = Banner.query.order_by(Banner.sort_order.desc()).all()
    return jsonify({'code': 200, 'data': [
        {'id': b.id, 'title': b.title, 'image': b.image, 'link_type': b.link_type, 'link_value': b.link_value, 'sort_order': b.sort_order, 'status': b.status}
        for b in banners
    ]})


@admin_bp.route('/banner/create', methods=['POST'])
def banner_create():
    """创建轮播图"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Banner
    data = request.get_json()

    banner = Banner(
        title=data.get('title', ''),
        image=data.get('image', ''),
        link_type=data.get('link_type', 'none'),
        link_value=data.get('link_value', ''),
        sort_order=data.get('sort_order', 0),
        status=data.get('status', 1)
    )
    db.session.add(banner)
    db.session.commit()
    return jsonify({'code': 200, 'message': '创建成功', 'data': {'id': banner.id}})


@admin_bp.route('/banner/update', methods=['POST'])
def banner_update():
    """更新轮播图"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Banner
    data = request.get_json()
    banner_id = data.get('id')

    banner = Banner.query.get(banner_id)
    if not banner:
        return jsonify({'code': 404, 'message': '轮播图不存在'}), 404

    if 'title' in data:
        banner.title = data['title']
    if 'image' in data:
        banner.image = data['image']
    if 'link_type' in data:
        banner.link_type = data['link_type']
    if 'link_value' in data:
        banner.link_value = data['link_value']
    if 'sort_order' in data:
        banner.sort_order = data['sort_order']
    if 'status' in data:
        banner.status = data['status']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@admin_bp.route('/banner/delete', methods=['POST'])
def banner_delete():
    """删除轮播图"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Banner
    data = request.get_json()
    banner_id = data.get('id')

    banner = Banner.query.get(banner_id)
    if not banner:
        return jsonify({'code': 404, 'message': '轮播图不存在'}), 404

    db.session.delete(banner)
    db.session.commit()
    return jsonify({'code': 200, 'message': '删除成功'})


# ==================== 数据看板 ====================

@admin_bp.route('/dashboard', methods=['GET'])
def dashboard():
    """获取运营数据看板"""
    admin = check_admin()
    if not admin:
        return jsonify({'code': 403, 'message': '权限不足'}), 403

    from database import db, Order, Product, User, OrderItem
    from datetime import datetime, timedelta

    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    week_ago = today_start - timedelta(days=7)

    # 今日数据（使用pay_time统计，因为订单可能昨天创建今天支付）
    today_orders = Order.query.filter(
        db.func.date(Order.pay_time) == today,
        Order.status.in_([1, 2, 3, 4, 5, 6])
    ).count()
    today_amount = db.session.query(db.func.sum(Order.pay_amount)).filter(
        db.func.date(Order.pay_time) == today,
        Order.status.in_([1, 2, 3, 4, 5, 6])
    ).scalar() or 0

    # 近7天订单数据
    week_orders_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        count = Order.query.filter(Order.created_at >= day_start, Order.created_at <= day_end).count()
        week_orders_data.append({
            'date': day.strftime('%m-%d'),
            'day_name': ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.weekday()],
            'count': count
        })

    # 热销商品TOP5
    top_products = db.session.query(
        OrderItem.product_name,
        db.func.sum(OrderItem.quantity).label('total_qty')
    ).join(Order).filter(
        Order.status.in_([1, 2, 3, 4, 5, 6])
    ).group_by(OrderItem.product_name).order_by(
        db.desc('total_qty')
    ).limit(5).all()
    top_products_data = [{'name': p.product_name, 'sales': p.total_qty} for p in top_products]

    # 总计数据
    total_orders = Order.query.count()
    total_amount = db.session.query(db.func.sum(Order.pay_amount)).filter(
        Order.status.in_([1, 2, 3, 4, 5, 6])
    ).scalar() or 0
    total_products = Product.query.filter_by(status=1).count()
    total_customers = User.query.filter_by(role='customer').count()
    total_riders = User.query.filter_by(role='rider', status=1).count()

    # 待处理订单
    pending_orders = Order.query.filter(Order.status.in_([1, 2])).count()

    return jsonify({'code': 200, 'data': {
        'today_orders': today_orders,
        'today_amount': float(today_amount),
        'week_orders': week_orders_data,
        'top_products': top_products_data,
        'total_orders': total_orders,
        'total_amount': float(total_amount),
        'total_products': total_products,
        'total_customers': total_customers,
        'total_riders': total_riders,
        'pending_orders': pending_orders
    }})