import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dayan-vegetable-secret-key-2024')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///dayan_vegetable.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_EXPIRATION_HOURS = 24 * 7  # 7 days