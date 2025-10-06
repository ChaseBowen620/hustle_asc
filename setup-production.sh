#!/bin/bash

echo "🔧 Setting up Hustle App for Production on EC2..."

# Get EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "📍 EC2 Public IP: $EC2_IP"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing nginx..."
    sudo apt install nginx -y
fi

# Run deployment script
echo "🚀 Running deployment..."
cd /home/ubuntu/hustle_asc
./deploy.sh

# Update nginx configuration with actual IP
echo "🔧 Configuring nginx..."
sudo sed -i "s/your-ec2-public-ip/$EC2_IP/g" /home/ubuntu/hustle_asc/nginx-hustle.conf
sudo cp /home/ubuntu/hustle_asc/nginx-hustle.conf /etc/nginx/sites-available/hustle
sudo ln -sf /etc/nginx/sites-available/hustle /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Enable and start services
echo "🔄 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable hustle-backend
sudo systemctl enable hustle-frontend
sudo systemctl enable nginx

sudo systemctl start hustle-backend
sudo systemctl start hustle-frontend
sudo systemctl start nginx

# Check service status
echo "📊 Service Status:"
echo "Backend: $(sudo systemctl is-active hustle-backend)"
echo "Frontend: $(sudo systemctl is-active hustle-frontend)"
echo "Nginx: $(sudo systemctl is-active nginx)"

echo "✅ Setup complete!"
echo "🌐 Your app should be accessible at: http://$EC2_IP"
echo "🔧 Admin panel: http://$EC2_IP/admin (admin/admin123)"
echo ""
echo "📋 Useful commands:"
echo "  Check logs: sudo journalctl -u hustle-backend -f"
echo "  Restart backend: sudo systemctl restart hustle-backend"
echo "  Restart frontend: sudo systemctl restart hustle-frontend"
echo "  Check status: sudo systemctl status hustle-backend hustle-frontend"
