import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QrCode, Download, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function QRCodeGenerator({ event, baseUrl = "http://52.8.4.183", isGeneral = false, organization = null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      if (organization) {
        // Organization-specific check-in URL
        const orgSlug = organization.toLowerCase().replace(/\s+/g, '') // Convert to lowercase and remove spaces
        const orgCheckInUrl = `${baseUrl}/check-in/${orgSlug}`
        setQrCodeUrl(orgCheckInUrl)
      } else if (isGeneral) {
        const generalCheckInUrl = `${baseUrl}/check-in`
        setQrCodeUrl(generalCheckInUrl)
      } else if (event) {
        const publicCheckInUrl = `${baseUrl}/check-in/public/${event.id}`
        setQrCodeUrl(publicCheckInUrl)
      }
    }
  }, [event, isOpen, baseUrl, isGeneral, organization])

  const generateQRCode = () => {
    let checkInUrl
    if (organization) {
      const orgSlug = organization.toLowerCase().replace(/\s+/g, '')
      checkInUrl = `${baseUrl}/check-in/${orgSlug}`
    } else if (isGeneral) {
      checkInUrl = `${baseUrl}/check-in`
    } else {
      checkInUrl = `${baseUrl}/check-in/public/${event.id}`
    }
    
    // Use a QR code service to generate the QR code
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`
    
    return qrCodeApiUrl
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeUrl)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Check-in URL copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive"
      })
    }
  }

  const downloadQRCode = () => {
    const qrCodeUrl = generateQRCode()
    const link = document.createElement('a')
    link.href = qrCodeUrl
    let filename
    if (organization) {
      filename = `${organization.toLowerCase().replace(/\s+/g, '_')}_checkin_qr.png`
    } else if (isGeneral) {
      filename = 'general_checkin_qr.png'
    } else {
      filename = `${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_checkin_qr.png`
    }
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "Downloaded!",
      description: "QR code image downloaded",
    })
  }

  if (!event && !isGeneral && !organization) return null

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="gap-2"
        variant="outline"
      >
        <QrCode className="h-4 w-4" />
        Generate QR Code
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {organization ? `${organization} Check-In QR Code` : isGeneral ? "General Check-In QR Code" : `QR Code for ${event.name}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-url">Public Check-in URL</Label>
              <div className="flex space-x-2">
                <Input
                  id="checkin-url"
                  value={qrCodeUrl}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-white p-4 rounded-lg border inline-block">
                <img
                  src={generateQRCode()}
                  alt={organization ? `${organization} Check-In QR Code` : isGeneral ? "General Check-In QR Code" : `QR Code for ${event.name}`}
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {organization 
                  ? `Students can scan this QR code to check in to ${organization} events`
                  : isGeneral 
                    ? "Students can scan this QR code to check in to the closest event"
                    : "Students can scan this QR code to check in"
                }
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
            <Button 
              onClick={downloadQRCode}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default QRCodeGenerator
