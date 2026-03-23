import os
from django.core.wsgi import get_wsgi_application

# Set the correct settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Compressly.settings")

# Initialize Django
application = get_wsgi_application()