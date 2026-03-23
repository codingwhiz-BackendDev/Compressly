from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/compress/', views.compress_image, name='compress'),
    path('api/batch/', views.batch_compress, name='batch'),
]
