import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Compressly.settings")

try:
    application = get_wsgi_application()
except Exception as e:
    import sys
    print("WSGI ERROR:", e, file=sys.stderr)
    raise e