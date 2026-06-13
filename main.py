import telebot
import requests
from telebot.types import ReplyKeyboardMarkup, KeyboardButton

TOKEN = "8605309655:AAFw-qtSn4TQKxqo3O3pHPNVANb5_MyRPI8"
bot = telebot.TeleBot(TOKEN)

user_state = {}

# ====== الأزرار ======
def main_menu():
    markup = ReplyKeyboardMarkup(resize_keyboard=True)
    markup.row(KeyboardButton("👨‍💻 المطور"), KeyboardButton("🌍 معلومات IP"))
    return markup

# ====== /start ======
@bot.message_handler(commands=['start'])
def start(message):
    bot.send_message(
        message.chat.id,
        "👋 مرحبًا بك في البوت\nاختر من الخيارات:",
        reply_markup=main_menu()
    )

# ====== الأزرار ======
@bot.message_handler(func=lambda m: True)
def handler(message):
    chat_id = message.chat.id
    text = message.text

    # المطور
    if text == "👨‍💻 المطور":
        bot.send_message(chat_id, "👨‍💻 المطور: ziko_f7l")

    # طلب IP
    elif text == "🌍 معلومات IP":
        bot.send_message(chat_id, "🌍 اكتب عنوان الـ IP الآن:")
        user_state[chat_id] = "waiting_ip"

    # استقبال IP
    elif user_state.get(chat_id) == "waiting_ip":
        ip = text.strip()

        try:
            res = requests.get(f"http://ip-api.com/json/{ip}").json()

            if res["status"] != "success":
                bot.send_message(chat_id, "❌ IP غير صحيح")
                return

            lat = res["lat"]
            lon = res["lon"]

            map_link = f"https://www.google.com/maps?q={lat},{lon}"

            info = f"""
🌍 IP: {ip}
🏳️ الدولة: {res['country']}
🏙️ المدينة: {res['city']}
📡 ISP: {res['isp']}
🛰️ ASN: {res['as']}
📍 Latitude: {lat}
📍 Longitude: {lon}

🗺️ الخريطة:
{map_link}
"""

            bot.send_message(chat_id, info)

        except:
            bot.send_message(chat_id, "❌ حصل خطأ في جلب المعلومات")

        user_state[chat_id] = None


bot.polling()
