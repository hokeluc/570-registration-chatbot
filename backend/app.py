import os

from flask import Flask

from options import bp as options_bp


def create_app():
    app = Flask(__name__)
    app.register_blueprint(options_bp)
    return app


if __name__ == "__main__":
    create_app().run(port=int(os.environ.get("PORT", 5001)), debug=True)
