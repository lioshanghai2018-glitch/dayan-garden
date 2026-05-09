from datetime import datetime, time
from app import create_app
from database import db, User, Category, Product, DeliverySlot, Banner, Supplier, Community


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()

        if User.query.filter_by(openid='admin').first():
            print('Database already initialized')
            return

        # 创建商家管理员
        admin = User(openid='admin', nickname='管理员', role='merchant', status=1)
        db.session.add(admin)

        # 创建骑手
        rider = User(openid='rider', nickname='配送员', role='rider', status=1)
        db.session.add(rider)

        # 创建分类
        categories_data = [
            ('叶菜类', 1),
            ('根茎类', 2),
            ('瓜果类', 3),
            ('菌菇类', 4),
            ('豆制品', 5),
            ('其他', 6)
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

        for name, subtitle, price, original_price, unit, stock, category_name, tags in products_data:
            product = Product(
                category_id=category_ids[category_name],
                name=name,
                subtitle=subtitle,
                price=price,
                original_price=original_price,
                unit=unit,
                stock=stock,
                tags=tags,
                status=1
            )
            db.session.add(product)

        # 创建配送时间段（次日达模式，3个时段）
        slot1 = DeliverySlot(
            name='08:00-10:00（早间）',
            start_time=time(8, 0),
            end_time=time(10, 0),
            max_orders=20,
            current_orders=0,
            status=1
        )
        slot2 = DeliverySlot(
            name='11:00-13:00（午间）',
            start_time=time(11, 0),
            end_time=time(13, 0),
            max_orders=20,
            current_orders=0,
            status=1
        )
        slot3 = DeliverySlot(
            name='15:00-17:00（下午）',
            start_time=time(15, 0),
            end_time=time(17, 0),
            max_orders=20,
            current_orders=0,
            status=1
        )
        db.session.add(slot1)
        db.session.add(slot2)
        db.session.add(slot3)

        # 创建默认轮播图
        banner1 = Banner(
            title='新鲜蔬菜 特惠促销',
            image='https://img.yzcdn.cn/vant/cat.jpeg',
            link_type='none',
            sort_order=1,
            status=1
        )
        banner2 = Banner(
            title='农家直供 安全保障',
            image='https://img.yzcdn.cn/vant/cat.jpeg',
            link_type='none',
            sort_order=2,
            status=1
        )
        db.session.add(banner1)
        db.session.add(banner2)

        # 创建小区列表
        communities = [
            '象山市场小区',
            '古城花园',
            '四方广场小区',
            '幸福里小区',
            '阳光花园'
        ]
        for name in communities:
            community = Community(name=name, status=1)
            db.session.add(community)

        # 创建供应商
        supplier = Supplier(
            name='大研农场',
            contact='张三',
            phone='13800138000',
            address='云南省丽江市古城区',
            description='专注有机蔬菜种植10年',
            status=1
        )
        db.session.add(supplier)

        db.session.commit()
        print('Database initialized successfully!')
        print('Admin account: admin / admin123')
        print('Rider account: rider / rider123')


if __name__ == '__main__':
    init_db()