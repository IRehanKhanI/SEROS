"""
Seed the SQLite database with 90 days of realistic historical electricity data.
This simulates the Kaggle utathya/electricity-consumption dataset pattern.

Run: python manage.py shell < Home/seed_data.py
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SEROSBackend.settings')

# Setup Django
import django
django.setup()

from Home.models import EnergyLog
from datetime import datetime, timedelta
import random
import math

print("🌱 Seeding historical energy data...")

# Clear old data
EnergyLog.objects.all().delete()
print("   Cleared old EnergyLog entries.")

# Generate 90 days of hourly data
now = datetime.now()
start = now - timedelta(days=90)

entries = []
for day_offset in range(90):
    date = start + timedelta(days=day_offset)
    day_of_week = date.weekday()  # 0=Mon, 6=Sun
    is_weekend = day_of_week >= 5
    
    # Seasonal temperature variation (Indian climate)
    base_temp = 28 + 8 * math.sin(2 * math.pi * day_offset / 90)  # 20-36°C range
    base_humidity = 55 + 20 * math.sin(2 * math.pi * (day_offset + 30) / 90)  # 35-75%
    
    for hour in range(24):
        ts = date.replace(hour=hour, minute=0, second=0, microsecond=0)
        
        # Temperature varies through the day
        temp = base_temp + 5 * math.sin(2 * math.pi * (hour - 6) / 24)
        temp += random.uniform(-1.5, 1.5)
        
        humidity = base_humidity + 10 * math.cos(2 * math.pi * (hour - 6) / 24)
        humidity += random.uniform(-3, 3)
        humidity = max(30, min(95, humidity))
        
        # Occupancy pattern: high during working hours, low at night/weekend
        if is_weekend:
            if 10 <= hour <= 14:
                occupancy = random.randint(2, 8)
            else:
                occupancy = random.randint(0, 2)
        else:
            if 8 <= hour <= 17:
                occupancy = random.randint(15, 45)
            elif 6 <= hour <= 20:
                occupancy = random.randint(3, 12)
            else:
                occupancy = random.randint(0, 2)
        
        # Energy = base + occupancy-driven + temperature-driven (AC load) + noise
        base_kwh = 2.5 if is_weekend else 8.0
        
        # Occupancy drives lights & fans
        occ_load = occupancy * 0.15
        
        # Temperature drives AC: above 30°C, AC kicks in hard
        ac_load = max(0, (temp - 28)) * 1.2 if not is_weekend or (10 <= hour <= 14) else 0
        
        # Night base load (servers, security lights)
        night_load = 3.0 if hour < 6 or hour > 22 else 0
        
        consumption = base_kwh + occ_load + ac_load + night_load + random.uniform(-1.0, 1.5)
        consumption = max(1.0, consumption)  # Minimum 1 kWh
        
        entries.append(EnergyLog(
            timestamp=ts,
            consumption_kwh=round(consumption, 2),
            temperature_c=round(temp, 1),
            humidity_pct=round(humidity, 1),
            occupancy=occupancy,
        ))

# Bulk insert
EnergyLog.objects.bulk_create(entries)
print(f"   ✅ Seeded {len(entries)} hourly records (90 days × 24 hours)")
print(f"   📊 Date range: {entries[0].timestamp} → {entries[-1].timestamp}")
print(f"   🔥 Total consumption: {sum(e.consumption_kwh for e in entries):.1f} kWh")
print("🌱 Done!")
