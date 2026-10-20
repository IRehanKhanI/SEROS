from django.core.management.base import BaseCommand
from seros.models import Device, Section, Zone


class Command(BaseCommand):
    help = "Create the initial configurable S.E.R.O.S. sections and default presentation devices."

    def handle(self, *args, **options):
        sections = []
        for index in range(1, 5):
            section, _ = Section.objects.get_or_create(
                name=f"Section {index}",
                defaults={"subtitle": "Configurable camera section"},
            )
            sections.append(section)

        for index, section in enumerate(sections):
            if index == 0:
                quadrants = [
                    ("Quadrant 1", [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]),
                    ("Quadrant 2", [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]]),
                    ("Quadrant 3", [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]]),
                    ("Quadrant 4", [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]]),
                ]
                for zone_name, points in quadrants:
                    Zone.objects.update_or_create(
                        section=section, name=zone_name,
                        defaults={"points": points, "shape_type": "rectangle"},
                    )
            else:
                Zone.objects.get_or_create(
                    section=section,
                    name=f"Section {index + 1} Zone",
                    defaults={"points": [[0, 0], [1, 0], [1, 1], [0, 1]], "shape_type": "rectangle"},
                )

        section = sections[0]
        default_fans = [
            ("dev-q1-fans-default", "Zone 1 Ceiling Fan", 1, 3),
            ("dev-q2-fans-default", "Zone 2 Ceiling Fan", 2, 2),
        ]
        for device_id, name, quadrant, relay in default_fans:
            device, _ = Device.objects.get_or_create(
                device_id=device_id,
                defaults={
                    "section": section,
                    "name": name,
                    "category": Device.FAN,
                    "relay": relay,
                    "power_watts": 65,
                    "is_on": False,
                    "speed": 0,
                },
            )
            zone = Zone.objects.filter(section=section, name=f"Quadrant {quadrant}").first()
            if zone:
                zone.assigned_devices.add(device)

        self.stdout.write(self.style.SUCCESS("S.E.R.O.S. sections and default devices initialized."))
