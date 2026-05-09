from flask import Blueprint, request, jsonify, g
from datetime import datetime

product_bp = Blueprint('product', __name__)


@product_bp.route('/list', methods=['GET'])
def list():
    """获取商品列表"""
    from database import db, Product, Category
    category_id = request.args.get('category_id', type=int)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    keyword = request.args.get('keyword', '')
    sort = request.args.get('sort', 'default')  # default, price_asc, price_desc, sales

    query = Product.query.filter_by(status=1)

    if category_id:
        query = query.filter_by(category_id=category_id)

    if keyword:
        query = query.filter(Product.name.like(f'%{keyword}%'))

    # 排序
    if sort == 'price_asc':
        query = query.order_by(Product.price.asc())
    elif sort == 'price_desc':
        query = query.order_by(Product.price.desc())
    else:
        query = query.order_by(Product.sort_order.desc(), Product.id.desc())

    pagination = query.paginate(page=page, per_page=page_size, error_out=False)

    products = []
    for p in pagination.items:
        products.append({
            'id': p.id,
            'name': p.name,
            'subtitle': p.subtitle,
            'price': float(p.price),
            'original_price': float(p.original_price) if p.original_price else None,
            'unit': p.unit,
            'stock': p.stock,
            'image': p.image,
            'tags': p.tags.split(',') if p.tags else []
        })

    return jsonify({'code': 200, 'data': {
        'list': products,
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page
    }})


@product_bp.route('/detail/<int:product_id>', methods=['GET'])
def detail(product_id):
    """获取商品详情"""
    from database import db, Product, Category, Supplier
    p = Product.query.get(product_id)
    if not p or p.status != 1:
        return jsonify({'code': 404, 'message': '商品不存在'}), 404

    category = Category.query.get(p.category_id) if p.category_id else None

    return jsonify({'code': 200, 'data': {
        'id': p.id,
        'name': p.name,
        'subtitle': p.subtitle,
        'price': float(p.price),
        'original_price': float(p.original_price) if p.original_price else None,
        'unit': p.unit,
        'stock': p.stock,
        'image': p.image,
        'images': p.images.split(',') if p.images else [],
        'description': p.description,
        'tags': p.tags.split(',') if p.tags else [],
        'category': {'id': category.id, 'name': category.name} if category else None
    }})


@product_bp.route('/categories', methods=['GET'])
def categories():
    """获取全部分类"""
    from database import db, Category
    categories = Category.query.filter_by(status=1).order_by(Category.sort_order.asc()).all()
    return jsonify({'code': 200, 'data': [
        {'id': c.id, 'name': c.name, 'icon': c.icon} for c in categories
    ]})


@product_bp.route('/recommend', methods=['GET'])
def recommend():
    """获取推荐商品"""
    from database import db, Product
    products = Product.query.filter_by(status=1).order_by(Product.id.desc()).limit(10).all()
    return jsonify({'code': 200, 'data': [
        {'id': p.id, 'name': p.name, 'price': float(p.price), 'image': p.image, 'unit': p.unit}
        for p in products
    ]})


@product_bp.route('/banners', methods=['GET'])
def banners():
    """获取首页轮播图"""
    from database import db, Banner
    now = datetime.now()
    banners = Banner.query.filter(
        Banner.status == 1,
        db.or_(Banner.start_time == None, Banner.start_time <= now),
        db.or_(Banner.end_time == None, Banner.end_time >= now)
    ).order_by(Banner.sort_order.desc()).all()
    return jsonify({'code': 200, 'data': [
        {'id': b.id, 'title': b.title, 'image': b.image, 'link_type': b.link_type, 'link_value': b.link_value}
        for b in banners
    ]})


@product_bp.route('/search', methods=['GET'])
def search():
    """搜索商品"""
    from database import db, Product
    keyword = request.args.get('keyword', '')
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)

    if not keyword:
        return jsonify({'code': 400, 'message': '请输入搜索关键词'}), 400

    pagination = Product.query.filter(
        Product.status == 1,
        Product.name.like(f'%{keyword}%')
    ).paginate(page=page, per_page=page_size, error_out=False)

    return jsonify({'code': 200, 'data': {
        'list': [{
            'id': p.id,
            'name': p.name,
            'price': float(p.price),
            'image': p.image,
            'unit': p.unit
        } for p in pagination.items],
        'total': pagination.total,
        'page': page
    }})