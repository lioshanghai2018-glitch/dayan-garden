from flask import Blueprint, request, jsonify, g
from functools import wraps
from datetime import datetime, timedelta
import jwt
import os

auth_bp = Blueprint('auth', __name__)
SECRET_KEY = os.getenv('SECRET_KEY', 'dayan-vegetable-secret-key-2024')


def generate_token(user_id, role):
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=24 * 7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        from database import User
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'code': 401, 'message': '请先登录'}), 401

        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            user = User.query.get(payload['user_id'])
            if not user:
                return jsonify({'code': 404, 'message': '用户不存在'}), 404
            if user.status != 1:
                return jsonify({'code': 403, 'message': '账号已被禁用'}), 403
            g.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'code': 401, 'message': '登录已过期，请重新登录'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'code': 401, 'message': '无效的登录凭证'}), 401

        return f(*args, **kwargs)
    return decorated


# ==================== 微信小程序登录 ====================

@auth_bp.route('/wechat/login', methods=['POST'])
def wechat_login():
    """微信小程序静默登录（无需用户授权）"""
    from database import db, User
    data = request.get_json()
    code = data.get('code')

    if not code:
        return jsonify({'code': 400, 'message': '缺少code参数'}), 400

    # 实际项目中应调用微信接口换取openid，这里演示用code作为标识
    openid = f"wx_{code}"

    user = User.query.filter_by(openid=openid).first()
    if not user:
        user = User(
            openid=openid,
            nickname=data.get('nickname', '微信用户'),
            avatar_url=data.get('avatar_url', ''),
            role='customer'
        )
        db.session.add(user)
        db.session.commit()

    token = generate_token(user.id, user.role)
    return jsonify({
        'code': 200,
        'message': '登录成功',
        'data': {
            'token': token,
            'user': {
                'id': user.id,
                'nickname': user.nickname,
                'avatar_url': user.avatar_url,
                'role': user.role
            }
        }
    })


@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册（兼容旧接口）"""
    from database import db, User
    data = request.get_json()
    openid = data.get('openid')
    nickname = data.get('nickname', '')
    avatar_url = data.get('avatar_url', '')

    if not openid:
        return jsonify({'code': 400, 'message': 'openid不能为空'}), 400

    existing = User.query.filter_by(openid=openid).first()
    if existing:
        token = generate_token(existing.id, existing.role)
        return jsonify({'code': 200, 'message': '用户已存在', 'data': {'token': token, 'user': {'id': existing.id, 'nickname': existing.nickname, 'role': existing.role}}})

    user = User(openid=openid, nickname=nickname, avatar_url=avatar_url, role='customer')
    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id, user.role)
    return jsonify({'code': 200, 'message': '注册成功', 'data': {'token': token, 'user': {'id': user.id, 'nickname': user.nickname, 'role': user.role}}})


# ==================== 商家登录 ====================

@auth_bp.route('/merchant/login', methods=['POST'])
def merchant_login():
    """商家管理员登录"""
    from database import db, User
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'code': 400, 'message': '用户名和密码不能为空'}), 400

    # 演示环境：支持 admin/admin123
    if username == 'admin' and password == 'admin123':
        user = User.query.filter_by(openid='admin', role='merchant').first()
        if user:
            token = generate_token(user.id, user.role)
            return jsonify({
                'code': 200,
                'message': '登录成功',
                'data': {
                    'token': token,
                    'user': {
                        'id': user.id,
                        'nickname': user.nickname,
                        'role': user.role
                    }
                }
            })

    return jsonify({'code': 401, 'message': '用户名或密码错误'}), 401


# ==================== 骑手登录 ====================

@auth_bp.route('/rider/login', methods=['POST'])
def rider_login():
    """骑手登录"""
    from database import db, User
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'code': 400, 'message': '用户名和密码不能为空'}), 400

    # 演示环境：支持 rider/rider123
    if username == 'rider' and password == 'rider123':
        user = User.query.filter_by(openid='rider', role='rider').first()
        if user:
            token = generate_token(user.id, user.role)
            return jsonify({
                'code': 200,
                'message': '登录成功',
                'data': {
                    'token': token,
                    'user': {
                        'id': user.id,
                        'nickname': user.nickname,
                        'role': user.role
                    }
                }
            })

    return jsonify({'code': 401, 'message': '用户名或密码错误'}), 401


# ==================== Token验证 ====================

@auth_bp.route('/verify', methods=['GET'])
@token_required
def verify():
    """验证登录状态"""
    user = g.current_user
    return jsonify({
        'code': 200,
        'data': {
            'id': user.id,
            'nickname': user.nickname,
            'avatar_url': user.avatar_url,
            'role': user.role
        }
    })


# ==================== 用户资料 ====================

@auth_bp.route('/profile', methods=['GET'])
@token_required
def profile():
    """获取用户资料"""
    user = g.current_user
    return jsonify({
        'code': 200,
        'data': {
            'id': user.id,
            'nickname': user.nickname,
            'avatar_url': user.avatar_url,
            'phone': user.phone,
            'role': user.role
        }
    })


@auth_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile():
    """更新用户资料"""
    from database import db
    user = g.current_user
    data = request.get_json()

    if 'nickname' in data:
        user.nickname = data['nickname']
    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url']
    if 'phone' in data:
        user.phone = data['phone']

    db.session.commit()
    return jsonify({'code': 200, 'message': '更新成功'})


@auth_bp.route('/phone/bind', methods=['POST'])
@token_required
def bind_phone():
    """绑定手机号"""
    from database import db
    user = g.current_user
    data = request.get_json()
    phone = data.get('phone')

    if not phone:
        return jsonify({'code': 400, 'message': '手机号不能为空'}), 400

    user.phone = phone
    db.session.commit()
    return jsonify({'code': 200, 'message': '绑定成功'})