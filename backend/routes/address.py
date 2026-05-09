from flask import Blueprint, request, jsonify, g

address_bp = Blueprint('address', __name__)


def get_user_id():
    user_id = request.headers.get('X-User-ID', type=int)
    if not user_id and hasattr(g, 'current_user'):
        return g.current_user.id
    return user_id


@address_bp.route('/list', methods=['GET'])
def list():
    """获取用户地址列表"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    addresses = Address.query.filter_by(user_id=user_id).order_by(Address.is_default.desc(), Address.id.desc()).all()
    return jsonify({'code': 200, 'data': [
        {
            'id': a.id,
            'name': a.name,
            'phone': a.phone,
            'community': a.community,
            'building': a.building or '',
            'room': a.room or '',
            'is_default': a.is_default
        } for a in addresses
    ]})


@address_bp.route('/create', methods=['POST'])
def create():
    """创建地址"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    name = data.get('name')
    phone = data.get('phone')
    community = data.get('community')
    building = data.get('building', '')
    room = data.get('room', '')
    is_default = data.get('is_default', 0)

    if not name or not phone or not community:
        return jsonify({'code': 400, 'message': '收货人、手机号、小区不能为空'}), 400

    # 如果设为默认，取消其他默认
    if is_default:
        Address.query.filter_by(user_id=user_id, is_default=1).update({'is_default': 0})

    address = Address(
        user_id=user_id,
        name=name,
        phone=phone,
        community=community,
        building=building,
        room=room,
        is_default=is_default
    )
    db.session.add(address)
    db.session.commit()

    return jsonify({'code': 200, 'message': '创建成功', 'data': {'id': address.id}})


@address_bp.route('/update', methods=['POST'])
def update():
    """更新地址"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    address_id = data.get('id')

    address = Address.query.get(address_id)
    if not address or address.user_id != user_id:
        return jsonify({'code': 404, 'message': '地址不存在'}), 404

    if 'name' in data:
        address.name = data['name']
    if 'phone' in data:
        address.phone = data['phone']
    if 'community' in data:
        address.community = data['community']
    if 'building' in data:
        address.building = data['building']
    if 'room' in data:
        address.room = data['room']

    # 如果设为默认，取消其他默认
    if data.get('is_default') and not address.is_default:
        Address.query.filter_by(user_id=user_id, is_default=1).update({'is_default': 0})
        address.is_default = 1

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@address_bp.route('/delete', methods=['POST'])
def delete():
    """删除地址"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    address_id = data.get('id')

    address = Address.query.get(address_id)
    if not address or address.user_id != user_id:
        return jsonify({'code': 404, 'message': '地址不存在'}), 404

    db.session.delete(address)
    db.session.commit()
    return jsonify({'code': 200, 'message': '删除成功'})


@address_bp.route('/set-default', methods=['POST'])
def set_default():
    """设为默认地址"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    data = request.get_json()
    address_id = data.get('id')

    address = Address.query.get(address_id)
    if not address or address.user_id != user_id:
        return jsonify({'code': 404, 'message': '地址不存在'}), 404

    # 取消所有默认
    Address.query.filter_by(user_id=user_id, is_default=1).update({'is_default': 0})
    address.is_default = 1
    db.session.commit()

    return jsonify({'code': 200, 'message': '设置成功'})


@address_bp.route('/detail/<int:address_id>', methods=['GET'])
def detail(address_id):
    """获取地址详情"""
    from database import db, Address
    user_id = get_user_id()
    if not user_id:
        return jsonify({'code': 401, 'message': '请先登录'}), 401

    address = Address.query.get(address_id)
    if not address or address.user_id != user_id:
        return jsonify({'code': 404, 'message': '地址不存在'}), 404

    return jsonify({'code': 200, 'data': {
        'id': address.id,
        'name': address.name,
        'phone': address.phone,
        'community': address.community,
        'building': address.building or '',
        'room': address.room or '',
        'is_default': address.is_default
    }})


@address_bp.route('/communities', methods=['GET'])
def communities():
    """获取小区列表"""
    from database import db, Community
    communities = Community.query.filter_by(status=1).all()
    return jsonify({'code': 200, 'data': [c.name for c in communities]})