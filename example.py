import requests

# Güncel API Adresi
URL = "https://use-ai-production.up.railway.app/v1/chat"

# Claude Opus 4.8 için hazırladığımız veri paketi
payload = {
    "model": "claude-opus-4-8",
    "messages": [
        {
            "role": "user",
            "content": "Selam Opus! Python'da kütüphane>
        }
    ]
}

try:
    # İsteği gönderiyoruz
    response = requests.post(URL, json=payload)

    if response.status_code == 200:
        res_data = response.json()
        # Gelen JSON'dan asistanın cevabını ayıklıyoruz
        content = res_data["choices"][0]["message"]["co>
        print(f"Opus 4.8: {content}")
    else:
        print(f"API Hatası (Kod {response.status_code})>

except requests.exceptions.RequestException as e:
    print(f"Bağlantı patladı: {e}")
