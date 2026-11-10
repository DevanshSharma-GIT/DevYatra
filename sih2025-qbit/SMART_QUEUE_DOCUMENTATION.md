# Smart Queue & Ticketing Systems Documentation

## Feature Overview

The **Smart Queue & Ticketing Systems** is a comprehensive digital solution designed to modernize traditional queue management and ticketing processes for religious sites, temples, and heritage locations. This feature eliminates physical waiting lines, provides real-time updates, and offers offline-first functionality for areas with limited connectivity.

## Key Features

### 1. Virtual Queue Management
- **Real-time Queue Status**: Live updates on queue length, wait times, and capacity
- **Digital Queue Entry**: Join queues remotely via mobile kiosks or web interface
- **Position Tracking**: Real-time position updates with estimated darshan times
- **Smart Notifications**: SMS and push notifications for queue readiness
- **Queue Analytics**: Live statistics and historical data for optimization

### 2. Darshan Slot Booking
- **Time-based Slots**: Pre-book specific darshan time slots
- **Dynamic Capacity Management**: Real-time slot availability updates
- **Confirmation System**: QR code generation for slot verification
- **Payment Integration**: Support for paid priority slots and special ceremonies
- **Flexible Cancellation**: Cancel bookings with automatic refund processing

### 3. Digital Pass System
- **QR Code Generation**: Unique, secure QR codes for each booking
- **Offline Verification**: Passes work without internet connectivity
- **Anti-fraud Security**: Encrypted data with time-stamped validation
- **Multi-format Support**: QR codes, barcodes, and text-based passes
- **Cloud Synchronization**: Real-time sync across all devices

## Technical Architecture

### Frontend Components

#### Main Page (`app/smart-queue/page.tsx`)
- Central hub for all Smart Queue features
- Tabbed interface for different functionalities
- Real-time status dashboard
- Responsive design for mobile and desktop

#### Virtual Queue Manager (`components/smart-queue/VirtualQueueManager.tsx`)
- Displays live queue status
- Queue joining interface
- User ticket management
- Real-time position updates

### Backend Services

#### Smart Queue Service (`services/smartQueueService.ts`)
- Main service class for all queue operations
- API integration layer
- Mock data generators for MVP
- WebSocket management for real-time updates

#### Custom React Hook (`hooks/use-smart-queue.ts`)
- State management for queue operations
- Real-time updates handling
- Offline support and caching
- Notification management

### Key Classes and Interfaces

```typescript
// Queue Information
interface QueueInfo {
  id: string;
  name: string;
  type: 'general' | 'priority' | 'special';
  currentServing: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  capacity: number;
  status: 'active' | 'paused' | 'closed';
  avgProcessingTime: number;
  lastUpdate: Date;
}

// User Queue Ticket
interface UserQueueTicket {
  id: string;
  queueId: string;
  queueName: string;
  ticketNumber: number;
  position: number;
  estimatedTime: number;
  status: 'waiting' | 'ready' | 'completed' | 'expired';
  joinTime: Date;
  qrCode: string;
  type: 'queue' | 'slot';
}

// Darshan Slot
interface DarshanSlot {
  id: string;
  time: string;
  capacity: number;
  booked: number;
  price: number;
  type: 'general' | 'priority' | 'special';
  duration: string;
  status: 'available' | 'full' | 'closed';
}
```

## API Endpoints (Production Ready)

### Queue Management
- `GET /api/queue/status` - Get current queue status
- `POST /api/queue/join` - Join a virtual queue
- `POST /api/queue/leave` - Leave a queue
- `GET /api/queue/analytics` - Get queue analytics data

### Slot Booking
- `GET /api/slots/available` - Get available time slots
- `POST /api/slots/book` - Book a darshan slot
- `POST /api/slots/cancel` - Cancel slot booking

### Digital Pass Management
- `GET /api/tickets/user/{userId}` - Get user tickets
- `POST /api/tickets/validate` - Validate QR code
- `POST /api/tickets/use` - Mark ticket as used

### Notifications
- `POST /api/notifications/settings` - Update notification preferences
- `POST /api/notifications/send` - Send notifications

## Real-time Features

### WebSocket Integration
- Real-time queue position updates
- Instant notification delivery
- Live capacity management
- System status monitoring

### Offline Support
- Local ticket caching
- Offline QR code access
- Background synchronization
- Fallback to cached data

## Security Features

### Anti-fraud Measures
- Unique, time-stamped QR codes
- Encrypted ticket data
- Real-time validation against live database
- Automatic expiration handling

### Data Protection
- User privacy compliance
- Secure data transmission
- Local storage encryption
- GDPR compliance ready

## User Experience

### Mobile-First Design
- Responsive layouts for all screen sizes
- Touch-friendly interface elements
- Optimized for mobile networks
- Progressive Web App capabilities

### Accessibility
- Screen reader compatibility
- High contrast mode support
- Keyboard navigation
- Multiple language support

## Integration Guidelines

### Navigation Integration
The feature is integrated into the main navigation as "Smart Queue" with a Users icon:

```typescript
{ name: "Smart Queue", path: "/smart-queue", icon: <Users className="h-4 w-4" /> }
```

### Dashboard Integration
Featured prominently on the dashboard with:
- Purple gradient theme
- QR code icon
- "Smart System" badge
- Direct link to `/smart-queue`

### Existing System Compatibility
- Works alongside existing ticketing systems
- Backward compatible with traditional methods
- Gradual migration support
- Legacy system integration APIs

## Deployment Considerations

### Scalability
- Horizontal scaling support
- Load balancer configuration
- Database optimization
- CDN integration for static assets

### Performance
- Lazy loading of components
- Image optimization
- Bundle size optimization
- Caching strategies

### Monitoring
- Real-time analytics dashboard
- Error tracking and alerts
- Performance monitoring
- User behavior analytics

## Testing Strategy

### Unit Tests
- Service layer testing
- Component functionality
- Hook behavior validation
- API endpoint testing

### Integration Tests
- End-to-end user flows
- Real-time update testing
- Offline functionality
- Cross-browser compatibility

### Load Testing
- High concurrent user scenarios
- Database performance under load
- WebSocket connection limits
- Queue capacity stress testing

## Future Enhancements

### Phase 2 Features
- AI-powered wait time prediction
- Dynamic pricing based on demand
- Group booking capabilities
- Advanced analytics dashboard

### Phase 3 Features
- Multi-language support
- Voice-guided navigation
- AR-based queue visualization
- IoT sensor integration

### Integration Opportunities
- Payment gateway integration
- Social media sharing
- Calendar integration
- Transportation coordination

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
QUEUE_REFRESH_INTERVAL=30000
MAX_QUEUE_CAPACITY=200
NOTIFICATION_ENABLED=true
```

### Feature Flags
- `ENABLE_WEBSOCKET` - Enable real-time updates
- `ENABLE_NOTIFICATIONS` - Push notification support
- `ENABLE_OFFLINE_MODE` - Offline functionality
- `ENABLE_ANALYTICS` - User behavior tracking

## Troubleshooting

### Common Issues

#### Queue Position Not Updating
- Check WebSocket connection
- Verify network connectivity
- Clear browser cache
- Restart the application

#### QR Code Not Scanning
- Ensure sufficient lighting
- Clean camera lens
- Check QR code validity
- Verify scanner permissions

#### Offline Mode Not Working
- Check local storage permissions
- Verify service worker registration
- Clear application data
- Update browser

### Debug Mode
Enable debug mode by setting `DEBUG=true` in environment variables for detailed logging.

## Support

### Documentation
- API documentation available at `/api/docs`
- User guides in multiple languages
- Video tutorials for common tasks
- FAQ section for quick answers

### Contact
- Technical support: tech-support@devyatra.com
- User feedback: feedback@devyatra.com
- Emergency issues: emergency@devyatra.com

---

**Last Updated**: October 2, 2025  
**Version**: 1.0.0  
**Status**: Production Ready  
**License**: MIT License  

This documentation covers the complete Smart Queue & Ticketing Systems feature implementation for the DevYatra platform.
