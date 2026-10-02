import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SEROSBackend.settings')

import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder
from pathlib import Path

print("[ML] Training SEROS ML Energy Predictor with Kaggle Dataset...")

# Using getcwd() because script is run via python manage.py shell from the SEROSBackend folder
base_dir = Path(os.getcwd()).resolve()
train_path = base_dir / 'train.csv'
test_path = base_dir / 'test.csv'

if not train_path.exists():
    print(f"[ERROR] Train file not found at {train_path}")
    sys.exit(1)

# 1. Load Data
df = pd.read_csv(train_path)
print(f"   Loaded {len(df)} records from train.csv")

# 2. Preprocess Data
df['datetime'] = pd.to_datetime(df['datetime'])
df['hour'] = df['datetime'].dt.hour
df['day_of_week'] = df['datetime'].dt.weekday
df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

# Encode var2
le = LabelEncoder()
df['var2_encoded'] = le.fit_transform(df['var2'])

# Select features
features = ['hour', 'day_of_week', 'is_weekend', 'temperature', 'var1', 'pressure', 'windspeed', 'var2_encoded']
X = df[features]
y = df['electricity_consumption']

# 3. Train Model
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("   Training RandomForestRegressor...")
model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
model.fit(X_train, y_train)

# 4. Evaluate
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"   MAE: {mae:.2f} kWh")
print(f"   R2 Score: {r2:.4f}")

importances = model.feature_importances_
for name, imp in sorted(zip(features, importances), key=lambda x: -x[1]):
    print(f"      {name}: {imp:.3f}")

# 5. Save Model and Encoder
model_data = {
    'model': model,
    'encoder': le,
    'features': features,
    'means': {
        'var1': df['var1'].mean(),
        'pressure': df['pressure'].mean(),
        'windspeed': df['windspeed'].mean()
    }
}

model_save_path = base_dir / 'ml_model.pkl'
with open(model_save_path, 'wb') as f:
    pickle.dump(model_data, f)
print(f"   Model saved to {model_save_path}")

# 6. Optional: Predict on test.csv if it exists
if test_path.exists():
    print(f"\n[ML] Predicting on {test_path}...")
    df_test = pd.read_csv(test_path)
    df_test['datetime'] = pd.to_datetime(df_test['datetime'])
    df_test['hour'] = df_test['datetime'].dt.hour
    df_test['day_of_week'] = df_test['datetime'].dt.weekday
    df_test['is_weekend'] = (df_test['day_of_week'] >= 5).astype(int)
    
    # Handle unseen labels just in case
    df_test['var2_encoded'] = df_test['var2'].map(lambda s: le.transform([s])[0] if s in le.classes_ else -1)
    
    X_unseen = df_test[features]
    df_test['electricity_consumption'] = model.predict(X_unseen)
    
    # Save predictions
    submission_path = base_dir / 'submission.csv'
    df_test[['ID', 'electricity_consumption']].to_csv(submission_path, index=False)
    print(f"   Predictions saved to {submission_path}")

print("[ML] Done!")
