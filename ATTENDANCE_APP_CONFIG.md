# Attendance App Configuration Guide

This guide helps you configure various types of attendance applications to work with your Hustle ASC webhook system.

## Webhook URLs

### Basic Webhook (No Authentication)
```
POST http://52.8.4.183:8000/api/webhook/attendance/
```

### Secure Webhook (HMAC Authentication)
```
POST http://52.8.4.183:8000/api/webhook/attendance/secure/
```

### Health Check
```
GET http://52.8.4.183:8000/api/webhook/status/
```

## Configuration Examples by App Type

### 1. QR Code Scanner Apps

**Popular Apps:** QR Code Scanner, QR Reader, etc.

**Configuration:**
- Set webhook URL: `http://52.8.4.183:8000/api/webhook/attendance/`
- Configure QR code format to include: `{"student_id": "a12345678", "event_id": "2"}`
- Set POST method with JSON payload

**Example QR Code Data:**
```json
{
  "student_identifier": "a12345678",
  "event_identifier": "2",
  "source": "qr_scanner"
}
```

### 2. RFID/NFC Card Readers

**Popular Systems:** HID, Proxmark, Arduino-based readers

**Configuration:**
- Map card IDs to student identifiers
- Set webhook URL: `http://52.8.4.183:8000/api/webhook/attendance/`
- Configure POST request on card tap

**Example Configuration:**
```python
# Card ID to Student mapping
CARD_MAPPING = {
    "1234567890": "a12345678",
    "0987654321": "a87654321"
}

# On card tap
def on_card_tap(card_id, event_id):
    student_id = CARD_MAPPING.get(card_id)
    if student_id:
        send_webhook(student_id, event_id)
```

### 3. Mobile Attendance Apps

**Popular Apps:** Custom mobile apps, attendance tracking apps

**Configuration:**
- Set webhook URL: `http://52.8.4.183:8000/api/webhook/attendance/`
- Configure student selection and event selection
- Set up automatic webhook calls

**Example JavaScript (React Native/Expo):**
```javascript
const recordAttendance = async (studentId, eventId) => {
  try {
    const response = await fetch('http://52.8.4.183:8000/api/webhook/attendance/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        student_identifier: studentId,
        event_identifier: eventId,
        source: 'mobile_app'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      alert('Attendance recorded successfully!');
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  }
};
```

### 4. Biometric Systems

**Popular Systems:** Fingerprint scanners, facial recognition systems

**Configuration:**
- Map biometric IDs to student identifiers
- Set webhook URL: `http://52.8.4.183:8000/api/webhook/attendance/`
- Configure webhook call on successful biometric match

**Example Python:**
```python
import requests

def on_biometric_match(biometric_id, event_id):
    # Map biometric ID to student
    student_id = get_student_by_biometric(biometric_id)
    
    payload = {
        "student_identifier": student_id,
        "event_identifier": event_id,
        "source": "biometric_system"
    }
    
    response = requests.post(
        'http://52.8.4.183:8000/api/webhook/attendance/',
        json=payload
    )
    
    return response.json()
```

### 5. Web-based Attendance Forms

**Popular Platforms:** Google Forms, Microsoft Forms, custom web forms

**Configuration:**
- Use Google Apps Script or similar to send webhooks
- Set webhook URL: `http://52.8.4.183:8000/api/webhook/attendance/`

**Example Google Apps Script:**
```javascript
function onSubmit(e) {
  const formData = e.values;
  const studentId = formData[1]; // Column B
  const eventId = formData[2];   // Column C
  
  const payload = {
    student_identifier: studentId,
    event_identifier: eventId,
    source: 'google_forms'
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch('http://52.8.4.183:8000/api/webhook/attendance/', options);
}
```

## Security Configuration (Optional)

For production use, enable HMAC signature verification:

### 1. Set Webhook Secret
```bash
export WEBHOOK_SECRET="your-secure-secret-key-here"
```

### 2. Generate HMAC Signature
```python
import hmac
import hashlib

def generate_signature(payload, secret):
    return hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

# Usage
payload = '{"student_identifier": "a12345678", "event_identifier": "2"}'
signature = generate_signature(payload, "your-secret")
headers = {"X-Webhook-Signature": signature}
```

### 3. Use Secure Endpoint
```
POST http://52.8.4.183:8000/api/webhook/attendance/secure/
```

## Testing Your Integration

### 1. Test Webhook Status
```bash
curl http://52.8.4.183:8000/api/webhook/status/
```

### 2. Test Basic Webhook
```bash
curl -X POST http://52.8.4.183:8000/api/webhook/attendance/ \
  -H "Content-Type: application/json" \
  -d '{
    "student_identifier": "admin2",
    "event_identifier": "2",
    "source": "test_app"
  }'
```

### 3. Test Secure Webhook
```bash
# Generate signature first, then:
curl -X POST http://52.8.4.183:8000/api/webhook/attendance/secure/ \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: your_generated_signature" \
  -d '{
    "student_identifier": "admin2",
    "event_identifier": "2",
    "source": "secure_test_app"
  }'
```

## Common Issues and Solutions

### 1. "Student not found" Error
- **Cause:** Student identifier doesn't match any student
- **Solution:** Check student A-numbers and emails in your system
- **Test:** Use `admin2` or `admin2@example.com` for testing

### 2. "Event not found" Error
- **Cause:** Event identifier doesn't match any event
- **Solution:** Check available events using the API
- **Test:** Use event IDs 2, 3, or 4 for testing

### 3. "Student already checked in" Error
- **Cause:** Duplicate attendance attempt
- **Solution:** This is expected behavior - student can only check in once per event

### 4. Network Connection Issues
- **Cause:** Firewall or network restrictions
- **Solution:** Ensure port 8000 is accessible from your attendance app
- **Test:** Use the status endpoint to verify connectivity

## Monitoring and Logs

### 1. Check Webhook Logs
```bash
cd /home/ubuntu/hustle_asc/backend
tail -f gunicorn.log
```

### 2. Monitor Attendance Records
- Check your Django admin interface
- View attendance data in your frontend application
- Use the attendance API endpoints

### 3. Set Up Alerts
- Monitor webhook response codes
- Set up notifications for failed webhook calls
- Track attendance patterns and anomalies

## Best Practices

1. **Always test first** with the provided test endpoints
2. **Handle errors gracefully** in your attendance app
3. **Implement retry logic** for failed webhook calls
4. **Log all webhook interactions** for debugging
5. **Use HTTPS in production** for secure communication
6. **Implement webhook signature verification** for security
7. **Monitor webhook performance** and response times

## Support

If you encounter issues:
1. Check the webhook status endpoint
2. Review Django application logs
3. Test with the provided curl examples
4. Verify network connectivity between systems
5. Check student and event data in your system









