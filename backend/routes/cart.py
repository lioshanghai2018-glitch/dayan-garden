from flask import Blueprint, request, jsonify, g

cart_bp = Blueprint('cart', __name__)


def get_user_id():
    """从请求头获取用户ID"""
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


@cart_bp.route('/list', methods=['GET'])
def list():
    from database import db, Cart, Product
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    carts = Cart.query.filter_by(user_id=user_id).all()
    items = []
    total = 0
    for c in carts:
        p = Product.query.get(c.product_id)
        if p and p.status == 1:
            items.append({
                'id': c.id,
                'product_id': p.id,
                'name': p.name,
                'image': p.image,
                'price': float(p.price),
                'unit': p.unit,
                'stock': p.stock,
                'quantity': c.quantity,
                'subtotal': float(p.price) * c.quantity
            })
            total += float(p.price) * c.quantity

    return jsonify({'code': 200, 'data': {'items': items, 'total': round(total, 2)}})


@cart_bp.route('/add', methods=['POST'])
def add():
    from database import db, Cart, Product
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)

    if not product_id:
        return jsonify({'code': 400, 'message': '商品ID不能为空'}), 400

    if quantity < 1:
        return jsonify({'code': 400, 'message': '数量必须大于0'}), 400

    product = Product.query.get(product_id)
    if not product or product.status != 1:
        return jsonify({'code': 404, 'message': '商品不存在或已下架'}), 404

    if product.stock < quantity:
        return jsonify({'code': 400, 'message': '库存不足，当前库存' + str(product.stock)}), 400

    cart = Cart.query.filter_by(user_id=user_id, product_id=product_id).first()
    if cart:
        new_qty = cart.quantity + quantity
        if product.stock < new_qty:
            return jsonify({'code': 400, 'message': '库存不足，当前库存' + str(product.stock)}), 400
        cart.quantity = new_qty
    else:
        cart = Cart(user_id=user_id, product_id=product_id, quantity=quantity)
        db.session.add(cart)

    db.session.commit()
    return jsonify({'code': 200, 'message': '添加成功'})


@cart_bp.route('/update', methods=['POST'])
def update():
    from database import db, Cart, Product
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    cart_id = data.get('cart_id')
    quantity = data.get('quantity', 1)

    cart = Cart.query.get(cart_id)
    if not cart or cart.user_id != user_id:
        return jsonify({'code': 404, 'message': '购物车项不存在'}), 404

    if quantity <= 0:
        db.session.delete(cart)
        db.session.commit()
        return jsonify({'code': 200, 'message': '已删除'})

    product = Product.query.get(cart.product_id)
    if product.stock < quantity:
        return jsonify({'code': 400, 'message': '库存不足，当前库存' + str(product.stock)}), 400

    cart.quantity = quantity
    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@cart_bp.route('/remove', methods=['POST'])
def remove():
    from database import db, Cart
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    cart_ids = data.get('cart_ids', [])

    if not cart_ids:
        return jsonify({'code': 400, 'message': '请选择要删除的商品'}), 400

    Cart.query.filter(Cart.user_id == user_id, Cart.id.in_(cart_ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'code': 200, 'message': '删除成功'})


@cart_bp.route('/clear', methods=['POST'])
def clear():
    from database import db, Cart
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    Cart.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'code': 200, 'message': '清空成功'})


@cart_bp.route('/count', methods=['GET'])
def count():
    from database import db, Cart
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 200, 'data': {'count': 0}})

    count = Cart.query.filter_by(user_id=user_id).count()
    return jsonify({'code': 200, 'data': {'count': count}})