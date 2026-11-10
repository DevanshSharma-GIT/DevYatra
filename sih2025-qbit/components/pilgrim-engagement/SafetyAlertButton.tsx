"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Phone, Shield, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SafetyAlertButtonProps {
  onAlertSent?: (alertData: any) => void;
  className?: string;
}

export default function SafetyAlertButton({ onAlertSent, className }: SafetyAlertButtonProps) {
  const [showAlert, setShowAlert] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const handleAlertClick = async () => {
    setIsSending(true)
    
    // Simulate API call
    setTimeout(() => {
      const alertData = {
        id: `alert-${Date.now()}`,
        type: 'emergency',
        message: 'Safety alert triggered by user',
        timestamp: new Date().toISOString(),
        severity: 'high'
      }

      setShowAlert(true)
      setIsSending(false)
      
      // Show success toast
      toast({
        title: "Safety Alert Sent",
        description: "Your alert has been sent to temple security and nearby pilgrims.",
      })

      // Call callback if provided
      onAlertSent?.(alertData)

      // Auto-hide after 5 seconds
      setTimeout(() => setShowAlert(false), 5000)
    }, 1000)
  }

  return (
    <>
      {/* Floating Alert Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        className={`fixed bottom-6 right-6 z-40 ${className}`}
      >
        <Button
          onClick={handleAlertClick}
          disabled={isSending}
          size="lg"
          className="bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg h-16 w-16 p-0"
        >
          {isSending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <AlertTriangle className="h-8 w-8" />
            </motion.div>
          ) : (
            <AlertTriangle className="h-8 w-8" />
          )}
        </Button>
      </motion.div>

      {/* Alert Popup */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAlert(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="bg-white max-w-md w-full shadow-xl">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-3 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <CardTitle className="text-red-700 text-xl">Safety Alert Sent</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-stone-600">
                    Your safety alert has been sent to temple security and nearby pilgrims.
                  </p>
                  
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <div className="text-sm text-red-800 font-medium mb-2">Emergency Contacts</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <Phone className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">+91-9876543210</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Shield className="h-4 w-4 text-red-600" />
                        <span className="text-red-700">Security: Available 24/7</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowAlert(false)}
                      variant="outline"
                      className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        // In a real app, this would trigger a phone call
                        window.open('tel:+919876543210')
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
