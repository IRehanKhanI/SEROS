from django.db import migrations


def add_default_fans(apps, schema_editor):
    Device = apps.get_model("seros", "Device")
    Zone = apps.get_model("seros", "Zone")
    section = apps.get_model("seros", "Section").objects.filter(id=1).first()
    if not section:
        return

    for device_id, name, quadrant, relay in [
        ("dev-q1-fans-default", "Zone 1 Ceiling Fan", 1, 3),
        ("dev-q2-fans-default", "Zone 2 Ceiling Fan", 2, 2),
    ]:
        device, _ = Device.objects.get_or_create(
            device_id=device_id,
            defaults={
                "section_id": section.id,
                "name": name,
                "category": "fans",
                "relay": relay,
                "power_watts": 65,
                "is_on": False,
                "speed": 0,
            },
        )
        zone = Zone.objects.filter(section_id=section.id, name=f"Quadrant {quadrant}").first()
        if zone:
            zone.assigned_devices.add(device)


def remove_default_fans(apps, schema_editor):
    Device = apps.get_model("seros", "Device")
    Device.objects.filter(device_id__in=[
        "dev-q1-fans-default",
        "dev-q2-fans-default",
    ]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("seros", "0002_roomlayout"),
    ]

    operations = [
        migrations.RunPython(add_default_fans, remove_default_fans),
    ]
