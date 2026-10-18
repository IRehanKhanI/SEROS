from django.urls import path
from seros import views

urlpatterns = [
    path("api/ping/", views.ping),
    path("api/state/", views.state),
    path("api/devices/", views.devices_api),
    path("api/devices/<str:device_id>/", views.device_detail),
    path("api/devices/<str:device_id>/update/", views.device_detail),
    path("api/devices/<str:device_id>/delete/", views.device_detail),
    path("api/devices/<str:device_id>/control/", views.control_device),
    path("api/zones/<int:zone_id>/", views.update_zone),
    path("api/detect/", views.detect),
    path("api/cameras/", views.cameras),
    path("api/camera/status/", views.camera_status),
    path("api/camera/latest/", views.latest_camera_frame),
    path("api/camera/frame/", views.latest_camera_frame),
    path("api/sections/", views.sections_api),
    path("api/sections/<int:section_id>/", views.delete_section),
    path("api/esp32/status/", views.esp32_status),
    path("api/layouts/", views.layouts_api),
    path("api/layouts/select/", views.select_layout),
    path("api/layouts/<str:layout_id>/", views.layout_detail),
    path("api/sensor/", views.sensor_data),
    path("api/weather/", views.weather_api),
    path("api/ai-automap/", views.ai_automap),
]

