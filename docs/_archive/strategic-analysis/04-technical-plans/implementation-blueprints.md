# Technical Implementation Plans
## P0 Feature Blueprints

**Purpose:** Detailed technical specifications for critical (P0) features, providing developers with implementation blueprints.

---

# 1. OTA CHANNEL INTEGRATION

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         V2 PLATFORM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐   │
│  │  Bookings   │───>│ Channel Manager │<───│  Rate Engine │   │
│  │  Service    │    │    Service      │    │              │   │
│  └─────────────┘    └────────┬────────┘    └──────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Channel Manager   │
                    │   (SiteMinder API)  │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ Booking.com │    │   Expedia   │    │   Airbnb    │
    └─────────────┘    └─────────────┘    └─────────────┘
```

## Database Schema

```sql
-- Channel manager configuration
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  channel_code VARCHAR(50) NOT NULL, -- 'booking_com', 'expedia', 'airbnb'
  channel_name VARCHAR(255),
  credentials JSONB NOT NULL, -- Encrypted
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room type mapping
CREATE TABLE channel_room_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES channel_connections(id),
  chalet_id UUID REFERENCES chalets(id),
  channel_room_id VARCHAR(100) NOT NULL,
  channel_room_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate plan mapping
CREATE TABLE channel_rate_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES channel_connections(id),
  rate_plan_id UUID, -- Internal rate plan
  channel_rate_id VARCHAR(100) NOT NULL,
  channel_rate_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync log
CREATE TABLE channel_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES channel_connections(id),
  sync_type VARCHAR(50), -- 'availability', 'rates', 'reservations'
  direction VARCHAR(20), -- 'push', 'pull'
  status VARCHAR(50),
  records_processed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Reservation source tracking
ALTER TABLE chalet_bookings ADD COLUMN source_channel VARCHAR(50);
ALTER TABLE chalet_bookings ADD COLUMN channel_booking_id VARCHAR(100);
ALTER TABLE chalet_bookings ADD COLUMN channel_confirmation VARCHAR(100);
```

## Service Implementation

```typescript
// backend/src/modules/channel-manager/services/channel-manager.service.ts

import { SiteMinderClient } from './siteminder.client';

@Injectable()
export class ChannelManagerService {
  constructor(
    private siteminder: SiteMinderClient,
    private bookingService: BookingService,
    private rateService: RateService,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  // Push availability to all connected channels
  async pushAvailability(chaletId: string, startDate: Date, endDate: Date) {
    const mappings = await this.prisma.channelRoomMappings.findMany({
      where: { chaletId, isActive: true },
      include: { connection: true }
    });

    const availability = await this.calculateAvailability(chaletId, startDate, endDate);

    const results = await Promise.allSettled(
      mappings.map(async (mapping) => {
        return this.siteminder.updateAvailability({
          connectionId: mapping.connection.id,
          roomId: mapping.channelRoomId,
          dates: availability
        });
      })
    );

    await this.logSyncResults('availability', 'push', results);
    return results;
  }

  // Push rates to all connected channels
  async pushRates(chaletId: string, startDate: Date, endDate: Date) {
    const rateMappings = await this.prisma.channelRateMappings.findMany({
      where: { 
        connection: { isActive: true },
        isActive: true 
      },
      include: { connection: true }
    });

    const rates = await this.rateService.getRatesForDateRange(chaletId, startDate, endDate);

    const results = await Promise.allSettled(
      rateMappings.map(async (mapping) => {
        return this.siteminder.updateRates({
          connectionId: mapping.connection.id,
          rateId: mapping.channelRateId,
          dates: rates
        });
      })
    );

    await this.logSyncResults('rates', 'push', results);
    return results;
  }

  // Pull reservations from channels
  async pullReservations(connectionId: string) {
    const connection = await this.prisma.channelConnections.findUnique({
      where: { id: connectionId }
    });

    const reservations = await this.siteminder.getReservations({
      connectionId,
      since: connection.lastSyncAt || new Date(Date.now() - 86400000)
    });

    const results = [];
    for (const reservation of reservations) {
      const result = await this.processIncomingReservation(reservation, connection);
      results.push(result);
    }

    await this.prisma.channelConnections.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() }
    });

    return results;
  }

  // Process incoming OTA reservation
  private async processIncomingReservation(
    channelReservation: ChannelReservation,
    connection: ChannelConnection
  ) {
    // Map channel room to internal chalet
    const mapping = await this.prisma.channelRoomMappings.findFirst({
      where: {
        connectionId: connection.id,
        channelRoomId: channelReservation.roomId
      }
    });

    if (!mapping) {
      throw new Error(`No mapping for channel room ${channelReservation.roomId}`);
    }

    // Check for existing booking (modification/cancellation)
    const existing = await this.prisma.chaletBookings.findFirst({
      where: {
        channelBookingId: channelReservation.id,
        sourceChannel: connection.channelCode
      }
    });

    if (channelReservation.status === 'cancelled') {
      if (existing) {
        return this.bookingService.cancel(existing.id, 'OTA Cancellation');
      }
      return { action: 'skip', reason: 'Cancellation for unknown booking' };
    }

    if (existing) {
      return this.bookingService.update(existing.id, {
        checkIn: channelReservation.checkIn,
        checkOut: channelReservation.checkOut,
        guests: channelReservation.guests,
        totalAmount: channelReservation.totalAmount
      });
    }

    // Create new booking
    return this.bookingService.create({
      chaletId: mapping.chaletId,
      checkIn: channelReservation.checkIn,
      checkOut: channelReservation.checkOut,
      guests: channelReservation.guests,
      guestName: channelReservation.guestName,
      guestEmail: channelReservation.guestEmail,
      guestPhone: channelReservation.guestPhone,
      totalAmount: channelReservation.totalAmount,
      status: 'confirmed',
      paymentStatus: channelReservation.prepaid ? 'paid' : 'pending',
      sourceChannel: connection.channelCode,
      channelBookingId: channelReservation.id,
      channelConfirmation: channelReservation.confirmationNumber
    });
  }

  // Scheduled sync job
  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduledSync() {
    const connections = await this.prisma.channelConnections.findMany({
      where: { isActive: true }
    });

    for (const connection of connections) {
      try {
        await this.pullReservations(connection.id);
      } catch (error) {
        this.logger.error(`Sync failed for ${connection.channelCode}`, error);
        await this.prisma.channelConnections.update({
          where: { id: connection.id },
          data: { 
            syncStatus: 'error',
            errorMessage: error.message 
          }
        });
      }
    }
  }
}
```

## API Endpoints

```typescript
// Channel Manager Routes
router.get('/channels', channelController.listConnections);
router.post('/channels', channelController.createConnection);
router.put('/channels/:id', channelController.updateConnection);
router.delete('/channels/:id', channelController.deleteConnection);
router.post('/channels/:id/test', channelController.testConnection);
router.post('/channels/:id/sync', channelController.triggerSync);
router.get('/channels/:id/logs', channelController.getSyncLogs);

// Mapping Routes
router.get('/channels/:id/rooms', channelController.getRoomMappings);
router.put('/channels/:id/rooms', channelController.updateRoomMappings);
router.get('/channels/:id/rates', channelController.getRateMappings);
router.put('/channels/:id/rates', channelController.updateRateMappings);
```

## Frontend Components

```tsx
// admin/channel-manager/page.tsx

export default function ChannelManagerPage() {
  const { data: connections } = useQuery(['channels'], fetchChannels);

  return (
    <AdminLayout>
      <PageHeader 
        title="Channel Manager" 
        description="Manage OTA connections and sync settings"
        action={<AddChannelButton />}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {connections?.map((connection) => (
          <ChannelCard 
            key={connection.id}
            connection={connection}
            onSync={() => triggerSync(connection.id)}
            onConfigure={() => openConfig(connection.id)}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncLogTable />
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
```

---

# 2. HARDWARE POS INTEGRATION

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      POS TERMINAL (Browser)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │   POS UI    │   │ Hardware     │   │ Print Service     │   │
│  │             │──>│ Bridge       │──>│ (Local Server)    │   │
│  └─────────────┘   └──────┬───────┘   └─────────┬─────────┘   │
│                           │                      │              │
└───────────────────────────┼──────────────────────┼──────────────┘
                            │                      │
                            ▼                      ▼
              ┌─────────────────────┐    ┌─────────────────┐
              │   Stripe Terminal   │    │ Receipt Printer │
              │   (Card Reader)     │    │ (Star/Epson)    │
              └─────────────────────┘    └─────────────────┘
```

## Stripe Terminal Integration

```typescript
// services/stripe-terminal.service.ts

import { Terminal, TerminalFactory } from '@stripe/terminal-js';

export class StripeTerminalService {
  private terminal: Terminal | null = null;
  private connectedReader: Reader | null = null;

  async initialize(connectionToken: string) {
    const TerminalClass = await TerminalFactory.create();
    
    this.terminal = TerminalClass.create({
      onFetchConnectionToken: async () => {
        const response = await fetch('/api/v1/payments/terminal/connection-token');
        const { secret } = await response.json();
        return secret;
      },
      onUnexpectedReaderDisconnect: () => {
        this.handleDisconnect();
      },
    });
  }

  async discoverReaders() {
    const config = { simulated: process.env.NODE_ENV === 'development' };
    const discoverResult = await this.terminal!.discoverReaders(config);
    
    if (discoverResult.error) {
      throw new Error(discoverResult.error.message);
    }
    
    return discoverResult.discoveredReaders;
  }

  async connectReader(readerId: string) {
    const readers = await this.discoverReaders();
    const reader = readers.find(r => r.id === readerId);
    
    if (!reader) {
      throw new Error('Reader not found');
    }

    const connectResult = await this.terminal!.connectReader(reader);
    
    if (connectResult.error) {
      throw new Error(connectResult.error.message);
    }
    
    this.connectedReader = connectResult.reader;
    return this.connectedReader;
  }

  async collectPayment(paymentIntentClientSecret: string): Promise<PaymentIntent> {
    if (!this.connectedReader) {
      throw new Error('No reader connected');
    }

    // Collect payment method
    const collectResult = await this.terminal!.collectPaymentMethod(
      paymentIntentClientSecret
    );

    if (collectResult.error) {
      throw new Error(collectResult.error.message);
    }

    // Process payment
    const processResult = await this.terminal!.processPayment(
      collectResult.paymentIntent
    );

    if (processResult.error) {
      throw new Error(processResult.error.message);
    }

    return processResult.paymentIntent;
  }

  async cancelCollect() {
    await this.terminal?.cancelCollectPaymentMethod();
  }

  async disconnectReader() {
    await this.terminal?.disconnectReader();
    this.connectedReader = null;
  }

  isConnected(): boolean {
    return this.connectedReader !== null;
  }

  getReaderStatus() {
    return this.connectedReader?.device_type 
      ? { connected: true, type: this.connectedReader.device_type }
      : { connected: false };
  }
}
```

## Receipt Printer Service

```typescript
// services/receipt-printer.service.ts

import escpos from 'escpos';
import USB from 'escpos-usb';
import Network from 'escpos-network';

interface PrintJob {
  type: 'receipt' | 'kitchen' | 'report';
  data: any;
  printer: PrinterConfig;
}

export class ReceiptPrinterService {
  private printers: Map<string, any> = new Map();

  async addPrinter(config: PrinterConfig) {
    let device;

    switch (config.connectionType) {
      case 'usb':
        device = new USB();
        break;
      case 'network':
        device = new Network(config.ipAddress, config.port || 9100);
        break;
      default:
        throw new Error('Unsupported connection type');
    }

    const printer = new escpos.Printer(device, { encoding: 'GB18030' });
    this.printers.set(config.id, { device, printer, config });
  }

  async printReceipt(printerId: string, receipt: Receipt) {
    const { device, printer, config } = this.printers.get(printerId) || {};
    
    if (!printer) {
      throw new Error('Printer not found');
    }

    return new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        printer
          // Header
          .align('ct')
          .style('b')
          .size(2, 2)
          .text(receipt.businessName)
          .size(1, 1)
          .style('normal')
          .text(receipt.businessAddress)
          .text(`Tel: ${receipt.businessPhone}`)
          .text('')
          
          // Order info
          .align('lt')
          .text(`Order: ${receipt.orderNumber}`)
          .text(`Date: ${receipt.dateTime}`)
          .text(`Server: ${receipt.serverName}`)
          .text(`Table: ${receipt.tableName || 'Takeaway'}`)
          .text(''.padEnd(48, '-'))
          
          // Items
          .tableCustom([
            { text: 'Item', width: 0.5 },
            { text: 'Qty', width: 0.15, align: 'CENTER' },
            { text: 'Price', width: 0.35, align: 'RIGHT' }
          ]);

        receipt.items.forEach(item => {
          printer.tableCustom([
            { text: item.name, width: 0.5 },
            { text: item.quantity.toString(), width: 0.15, align: 'CENTER' },
            { text: `$${item.total.toFixed(2)}`, width: 0.35, align: 'RIGHT' }
          ]);
          
          item.modifiers?.forEach(mod => {
            printer.text(`  + ${mod.name}`);
          });
        });

        printer
          .text(''.padEnd(48, '-'))
          
          // Totals
          .tableCustom([
            { text: 'Subtotal:', width: 0.7 },
            { text: `$${receipt.subtotal.toFixed(2)}`, width: 0.3, align: 'RIGHT' }
          ])
          .tableCustom([
            { text: 'Tax:', width: 0.7 },
            { text: `$${receipt.tax.toFixed(2)}`, width: 0.3, align: 'RIGHT' }
          ]);

        if (receipt.tip > 0) {
          printer.tableCustom([
            { text: 'Tip:', width: 0.7 },
            { text: `$${receipt.tip.toFixed(2)}`, width: 0.3, align: 'RIGHT' }
          ]);
        }

        printer
          .text(''.padEnd(48, '-'))
          .style('b')
          .size(2, 2)
          .tableCustom([
            { text: 'TOTAL:', width: 0.6 },
            { text: `$${receipt.total.toFixed(2)}`, width: 0.4, align: 'RIGHT' }
          ])
          .size(1, 1)
          .style('normal')
          .text('')
          
          // Payment info
          .text(`Payment: ${receipt.paymentMethod}`)
          .text(`Card: ****${receipt.cardLast4 || ''}`)
          .text('')
          
          // Footer
          .align('ct')
          .text('Thank you for your visit!')
          .text('')
          .qrcode(receipt.receiptUrl, { type: 'svg', size: 6 })
          .text('Scan for digital receipt')
          .text('')
          .cut()
          .close(() => resolve(true));
      });
    });
  }

  async printKitchenTicket(printerId: string, ticket: KitchenTicket) {
    const { device, printer } = this.printers.get(printerId) || {};
    
    if (!printer) {
      throw new Error('Printer not found');
    }

    return new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        printer
          .align('ct')
          .style('b')
          .size(2, 2)
          .text(`** ${ticket.type.toUpperCase()} **`)
          .text('')
          .size(1, 1)
          .align('lt')
          .text(`Order: ${ticket.orderNumber}`)
          .text(`Table: ${ticket.tableName}`)
          .text(`Time: ${ticket.orderTime}`)
          .text(''.padEnd(32, '='));

        ticket.items.forEach(item => {
          printer
            .style('b')
            .size(2, 1)
            .text(`${item.quantity}x ${item.name}`)
            .size(1, 1)
            .style('normal');

          item.modifiers?.forEach(mod => {
            printer.text(`   >> ${mod.name}`);
          });

          if (item.specialInstructions) {
            printer
              .style('b')
              .text(`   !! ${item.specialInstructions}`)
              .style('normal');
          }

          printer.text('');
        });

        if (ticket.specialInstructions) {
          printer
            .text(''.padEnd(32, '-'))
            .style('b')
            .text('NOTES:')
            .text(ticket.specialInstructions);
        }

        printer
          .text('')
          .cut()
          .close(() => resolve(true));
      });
    });
  }

  async openCashDrawer(printerId: string) {
    const { device, printer } = this.printers.get(printerId) || {};
    
    if (!printer) {
      throw new Error('Printer not found');
    }

    return new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        printer
          .cashdraw(2) // Kick cash drawer
          .close(() => resolve(true));
      });
    });
  }

  async testPrinter(printerId: string) {
    const { device, printer, config } = this.printers.get(printerId) || {};
    
    if (!printer) {
      throw new Error('Printer not found');
    }

    return new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject({ success: false, error: error.message });
          return;
        }

        printer
          .align('ct')
          .text('*** TEST PRINT ***')
          .text(`Printer: ${config.name}`)
          .text(`Time: ${new Date().toLocaleString()}`)
          .text('')
          .text('If you can read this,')
          .text('printer is working correctly!')
          .text('')
          .cut()
          .close(() => resolve({ success: true }));
      });
    });
  }
}
```

## Hardware Management UI

```tsx
// admin/settings/hardware/page.tsx

export default function HardwareSettingsPage() {
  const { data: devices } = useQuery(['hardware-devices'], fetchDevices);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleDiscoverReaders = async () => {
    setIsDiscovering(true);
    try {
      const readers = await stripeTerminal.discoverReaders();
      setDiscoveredReaders(readers);
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader 
        title="Hardware Settings"
        description="Configure card readers, printers, and cash drawers"
      />

      <Tabs defaultValue="card-readers">
        <TabsList>
          <TabsTrigger value="card-readers">Card Readers</TabsTrigger>
          <TabsTrigger value="printers">Printers</TabsTrigger>
          <TabsTrigger value="cash-drawers">Cash Drawers</TabsTrigger>
        </TabsList>

        <TabsContent value="card-readers">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Terminal Readers</CardTitle>
              <CardDescription>
                Connect and manage card readers for in-person payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDiscoverReaders} disabled={isDiscovering}>
                {isDiscovering ? 'Discovering...' : 'Discover Readers'}
              </Button>

              <div className="mt-6 space-y-4">
                {devices?.readers.map((reader) => (
                  <DeviceCard
                    key={reader.id}
                    device={reader}
                    type="reader"
                    onConnect={() => connectReader(reader.id)}
                    onDisconnect={() => disconnectReader(reader.id)}
                    onTest={() => testReader(reader.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printers">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Printers</CardTitle>
              <CardDescription>
                Configure printers for receipts and kitchen tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddPrinterDialog onAdd={handleAddPrinter} />

              <div className="mt-6 space-y-4">
                {devices?.printers.map((printer) => (
                  <PrinterCard
                    key={printer.id}
                    printer={printer}
                    onConfigure={() => openPrinterConfig(printer.id)}
                    onTest={() => testPrinter(printer.id)}
                    onDelete={() => deletePrinter(printer.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-drawers">
          <Card>
            <CardHeader>
              <CardTitle>Cash Drawers</CardTitle>
              <CardDescription>
                Cash drawers are triggered through connected printers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices?.printers
                  .filter(p => p.hasCashDrawer)
                  .map((printer) => (
                    <div key={printer.id} className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <p className="font-medium">{printer.name}</p>
                        <p className="text-sm text-gray-500">
                          Connected via {printer.connectionType}
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => openCashDrawer(printer.id)}
                      >
                        Open Drawer
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
```

---

# 3. QUICKBOOKS INTEGRATION

## OAuth2 Connection Flow

```typescript
// services/quickbooks.service.ts

import OAuthClient from 'intuit-oauth';
import { QuickBooks } from 'node-quickbooks';

export class QuickBooksService {
  private oauthClient: OAuthClient;
  private qbo: QuickBooks | null = null;

  constructor() {
    this.oauthClient = new OAuthClient({
      clientId: process.env.QB_CLIENT_ID!,
      clientSecret: process.env.QB_CLIENT_SECRET!,
      environment: process.env.QB_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QB_REDIRECT_URI!,
    });
  }

  // Generate OAuth URL
  getAuthUrl(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: crypto.randomBytes(16).toString('hex'),
    });
  }

  // Handle OAuth callback
  async handleCallback(url: string): Promise<TokenSet> {
    const authResponse = await this.oauthClient.createToken(url);
    
    const tokenSet = {
      accessToken: authResponse.token.access_token,
      refreshToken: authResponse.token.refresh_token,
      realmId: authResponse.token.realmId,
      expiresAt: new Date(Date.now() + authResponse.token.expires_in * 1000),
    };

    await this.saveTokens(tokenSet);
    return tokenSet;
  }

  // Initialize QB client with tokens
  private async initClient() {
    const tokens = await this.getTokens();
    
    if (!tokens) {
      throw new Error('QuickBooks not connected');
    }

    // Check if token needs refresh
    if (new Date() > tokens.expiresAt) {
      await this.refreshTokens();
    }

    this.qbo = new QuickBooks(
      process.env.QB_CLIENT_ID!,
      process.env.QB_CLIENT_SECRET!,
      tokens.accessToken,
      false, // no oauth1
      tokens.realmId,
      process.env.QB_ENVIRONMENT === 'production',
      true, // debug
      null,
      '2.0', // minorversion
      tokens.refreshToken
    );
  }

  // Sync daily sales to QuickBooks
  async syncDailySales(date: Date) {
    await this.initClient();

    const sales = await this.getSalesForDate(date);
    
    // Create Sales Receipt in QuickBooks
    const salesReceipt = {
      Line: [
        {
          Amount: sales.total,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: await this.getItemRef('Daily Sales') },
            Qty: 1,
            UnitPrice: sales.total,
          },
        },
      ],
      CustomerRef: { value: await this.getCustomerRef('Daily Sales') },
      TxnDate: date.toISOString().split('T')[0],
      PrivateNote: `V2 Daily Sales - ${date.toLocaleDateString()}`,
      CustomField: [
        {
          Name: 'Sales Breakdown',
          StringValue: JSON.stringify({
            restaurant: sales.restaurant,
            pool: sales.pool,
            chalets: sales.chalets,
            giftCards: sales.giftCards,
          }),
        },
      ],
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createSalesReceipt(salesReceipt, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  // Create invoice for booking
  async createBookingInvoice(booking: ChaletBooking) {
    await this.initClient();

    const invoice = {
      Line: [
        {
          Amount: booking.baseTotal,
          DetailType: 'SalesItemLineDetail',
          Description: `${booking.chalet.name} - ${booking.checkIn} to ${booking.checkOut}`,
          SalesItemLineDetail: {
            ItemRef: { value: await this.getItemRef('Accommodation') },
            Qty: booking.nights,
            UnitPrice: booking.baseTotal / booking.nights,
          },
        },
        ...booking.addons.map(addon => ({
          Amount: addon.price,
          DetailType: 'SalesItemLineDetail',
          Description: addon.name,
          SalesItemLineDetail: {
            ItemRef: { value: await this.getItemRef('Add-ons') },
            Qty: 1,
            UnitPrice: addon.price,
          },
        })),
      ],
      CustomerRef: { 
        value: await this.getOrCreateCustomer(booking.user) 
      },
      BillEmail: { Address: booking.guestEmail },
      DueDate: booking.checkIn,
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createInvoice(invoice, (err, result) => {
        if (err) reject(err);
        else {
          // Store QB invoice ID in our database
          this.linkInvoiceToBooking(booking.id, result.Id);
          resolve(result);
        }
      });
    });
  }

  // Sync customer to QuickBooks
  async syncCustomer(user: User): Promise<string> {
    await this.initClient();

    // Check if customer exists
    const existing = await this.findCustomerByEmail(user.email);
    
    if (existing) {
      return existing.Id;
    }

    const customer = {
      DisplayName: user.fullName,
      GivenName: user.fullName.split(' ')[0],
      FamilyName: user.fullName.split(' ').slice(1).join(' '),
      PrimaryEmailAddr: { Address: user.email },
      PrimaryPhone: { FreeFormNumber: user.phone },
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createCustomer(customer, (err, result) => {
        if (err) reject(err);
        else resolve(result.Id);
      });
    });
  }

  // Sync vendor (supplier) to QuickBooks
  async syncSupplier(supplier: Supplier): Promise<string> {
    await this.initClient();

    const vendor = {
      DisplayName: supplier.name,
      PrimaryEmailAddr: { Address: supplier.email },
      PrimaryPhone: { FreeFormNumber: supplier.phone },
      BillAddr: {
        Line1: supplier.address,
      },
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createVendor(vendor, (err, result) => {
        if (err) reject(err);
        else resolve(result.Id);
      });
    });
  }

  // Create bill from purchase order
  async createBillFromPO(purchaseOrder: PurchaseOrder) {
    await this.initClient();

    const vendorId = await this.syncSupplier(purchaseOrder.supplier);

    const bill = {
      VendorRef: { value: vendorId },
      Line: purchaseOrder.items.map(item => ({
        Amount: item.totalCost,
        DetailType: 'ItemBasedExpenseLineDetail',
        ItemBasedExpenseLineDetail: {
          ItemRef: { value: await this.getItemRef(item.name) },
          Qty: item.quantity,
          UnitPrice: item.unitCost,
        },
      })),
      TxnDate: purchaseOrder.receivedDate?.toISOString().split('T')[0],
      DocNumber: purchaseOrder.poNumber,
    };

    return new Promise((resolve, reject) => {
      this.qbo!.createBill(bill, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}
```

## Sync Configuration UI

```tsx
// admin/settings/integrations/quickbooks/page.tsx

export default function QuickBooksIntegrationPage() {
  const { data: connection } = useQuery(['qb-connection'], getQBConnection);
  const { data: syncSettings } = useQuery(['qb-sync-settings'], getQBSyncSettings);

  const handleConnect = async () => {
    const authUrl = await getQBAuthUrl();
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (confirm('Disconnect from QuickBooks? This will stop all syncing.')) {
      await disconnectQB();
      queryClient.invalidateQueries(['qb-connection']);
    }
  };

  return (
    <AdminLayout>
      <PageHeader 
        title="QuickBooks Integration"
        description="Sync sales, invoices, and expenses with QuickBooks Online"
      />

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {connection?.connected ? (
            <div className="flex items-center gap-4">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm text-gray-500">
                Company: {connection.companyName}
              </span>
              <Button variant="outline" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Badge variant="secondary">Not Connected</Badge>
              <Button onClick={handleConnect}>
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {connection?.connected && (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="space-y-6">
                  <FormField
                    name="syncSales"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Sync Daily Sales</FormLabel>
                          <FormDescription>
                            Automatically create sales receipts for each day's revenue
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="syncInvoices"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Sync Booking Invoices</FormLabel>
                          <FormDescription>
                            Create invoices in QuickBooks for chalet bookings
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="syncExpenses"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Sync Purchase Orders</FormLabel>
                          <FormDescription>
                            Create bills in QuickBooks when POs are received
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="syncCustomers"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Sync Customers</FormLabel>
                          <FormDescription>
                            Create customer records in QuickBooks
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="mt-6">
                  Save Settings
                </Button>
              </Form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Mapping</CardTitle>
              <CardDescription>
                Map V2 categories to QuickBooks accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccountMappingForm />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
            </CardHeader>
            <CardContent>
              <SyncHistoryTable />
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
```

---

# 4. OFFLINE POS MODE

## IndexedDB Schema

```typescript
// services/offline/schema.ts

import { DBSchema, openDB, IDBPDatabase } from 'idb';

interface V2OfflineDB extends DBSchema {
  menu: {
    key: string;
    value: MenuItem;
    indexes: { 'by-category': string };
  };
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-phone': string; 'by-email': string };
  };
  pendingOrders: {
    key: string;
    value: OfflineOrder;
    indexes: { 'by-status': string; 'by-created': Date };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string };
  };
}

export async function initOfflineDB(): Promise<IDBPDatabase<V2OfflineDB>> {
  return openDB<V2OfflineDB>('v2-offline', 1, {
    upgrade(db) {
      // Menu store
      const menuStore = db.createObjectStore('menu', { keyPath: 'id' });
      menuStore.createIndex('by-category', 'categoryId');

      // Customers store
      const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
      customerStore.createIndex('by-phone', 'phone');
      customerStore.createIndex('by-email', 'email');

      // Pending orders store
      const orderStore = db.createObjectStore('pendingOrders', { keyPath: 'localId' });
      orderStore.createIndex('by-status', 'status');
      orderStore.createIndex('by-created', 'createdAt');

      // Sync queue store
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-status', 'status');
    },
  });
}
```

## Offline Order Service

```typescript
// services/offline/offline-order.service.ts

export class OfflineOrderService {
  private db: IDBPDatabase<V2OfflineDB>;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.initDB();
    this.setupNetworkListeners();
  }

  private async initDB() {
    this.db = await initOfflineDB();
    await this.preloadCache();
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingOrders();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyOfflineMode();
    });
  }

  // Preload menu and customer data for offline use
  async preloadCache() {
    if (!this.isOnline) return;

    try {
      // Cache menu items
      const menu = await fetch('/api/v1/restaurant/menu').then(r => r.json());
      const tx = this.db.transaction('menu', 'readwrite');
      for (const item of menu.data) {
        await tx.store.put(item);
      }
      await tx.done;

      // Cache frequent customers
      const customers = await fetch('/api/v1/users/frequent?limit=1000').then(r => r.json());
      const customerTx = this.db.transaction('customers', 'readwrite');
      for (const customer of customers.data) {
        await customerTx.store.put(customer);
      }
      await customerTx.done;

      console.log('Offline cache preloaded');
    } catch (error) {
      console.error('Failed to preload offline cache', error);
    }
  }

  // Create order (works offline)
  async createOrder(orderData: CreateOrderDto): Promise<OfflineOrder> {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const offlineOrder: OfflineOrder = {
      localId,
      ...orderData,
      status: 'pending',
      syncStatus: 'pending',
      createdAt: new Date(),
      isOffline: !this.isOnline,
    };

    // Save to IndexedDB
    await this.db.put('pendingOrders', offlineOrder);

    // If online, sync immediately
    if (this.isOnline) {
      await this.syncOrder(offlineOrder);
    } else {
      // Add to sync queue
      await this.db.put('syncQueue', {
        id: localId,
        type: 'order',
        data: offlineOrder,
        status: 'pending',
        createdAt: new Date(),
      });

      this.notifyOrderQueued();
    }

    return offlineOrder;
  }

  // Sync single order
  private async syncOrder(order: OfflineOrder): Promise<void> {
    try {
      const response = await fetch('/api/v1/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error('Failed to sync order');
      }

      const serverOrder = await response.json();

      // Update local order with server ID
      order.serverId = serverOrder.data.id;
      order.syncStatus = 'synced';
      await this.db.put('pendingOrders', order);

      // Remove from sync queue
      await this.db.delete('syncQueue', order.localId);

      this.notifyOrderSynced(order);
    } catch (error) {
      order.syncStatus = 'failed';
      order.syncError = error.message;
      await this.db.put('pendingOrders', order);
      throw error;
    }
  }

  // Sync all pending orders
  async syncPendingOrders(): Promise<SyncResult> {
    const pending = await this.db.getAllFromIndex('syncQueue', 'by-status', 'pending');
    
    const results = {
      total: pending.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const item of pending) {
      try {
        if (item.type === 'order') {
          await this.syncOrder(item.data as OfflineOrder);
          results.synced++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Order ${item.id}: ${error.message}`);
      }
    }

    return results;
  }

  // Get menu (from cache when offline)
  async getMenu(): Promise<MenuItem[]> {
    if (this.isOnline) {
      try {
        const response = await fetch('/api/v1/restaurant/menu');
        const data = await response.json();
        
        // Update cache
        const tx = this.db.transaction('menu', 'readwrite');
        for (const item of data.data) {
          await tx.store.put(item);
        }
        await tx.done;
        
        return data.data;
      } catch {
        // Fall back to cache
      }
    }

    return this.db.getAll('menu');
  }

  // Search customers (from cache when offline)
  async searchCustomers(query: string): Promise<Customer[]> {
    if (this.isOnline) {
      try {
        const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
        return (await response.json()).data;
      } catch {
        // Fall back to cache
      }
    }

    // Search local cache
    const allCustomers = await this.db.getAll('customers');
    const lowerQuery = query.toLowerCase();
    
    return allCustomers.filter(c => 
      c.fullName?.toLowerCase().includes(lowerQuery) ||
      c.phone?.includes(query) ||
      c.email?.toLowerCase().includes(lowerQuery)
    );
  }

  // Process offline payment (cash only)
  async processOfflinePayment(orderId: string, amount: number, paymentMethod: 'cash'): Promise<void> {
    const order = await this.db.get('pendingOrders', orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }

    if (paymentMethod !== 'cash') {
      throw new Error('Only cash payments supported offline');
    }

    order.paymentStatus = 'paid';
    order.paymentMethod = 'cash';
    order.amountPaid = amount;
    
    await this.db.put('pendingOrders', order);
  }

  // Get sync status
  async getSyncStatus(): Promise<{ pending: number; failed: number }> {
    const pending = await this.db.countFromIndex('syncQueue', 'by-status', 'pending');
    const failed = await this.db.countFromIndex('syncQueue', 'by-status', 'failed');
    return { pending, failed };
  }

  private notifyOfflineMode() {
    eventBus.emit('offline-mode-activated');
    toast.warning('You are now offline. Orders will be saved locally.');
  }

  private notifyOrderQueued() {
    toast.info('Order saved locally. Will sync when online.');
  }

  private notifyOrderSynced(order: OfflineOrder) {
    eventBus.emit('order-synced', order);
  }
}
```

## Offline Status UI Component

```tsx
// components/pos/OfflineStatusBar.tsx

export function OfflineStatusBar() {
  const { isOnline, pendingCount, failedCount } = useOfflineStatus();

  if (isOnline && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 p-3 flex items-center justify-between z-50',
      isOnline ? 'bg-green-100' : 'bg-yellow-100'
    )}>
      <div className="flex items-center gap-2">
        {isOnline ? (
          <WifiIcon className="w-5 h-5 text-green-600" />
        ) : (
          <WifiOffIcon className="w-5 h-5 text-yellow-600" />
        )}
        <span className="font-medium">
          {isOnline ? 'Online' : 'Offline Mode'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {pendingCount > 0 && (
          <Badge variant="warning">
            {pendingCount} orders pending sync
          </Badge>
        )}
        
        {failedCount > 0 && (
          <Badge variant="destructive">
            {failedCount} sync failures
          </Badge>
        )}

        {isOnline && pendingCount > 0 && (
          <Button size="sm" onClick={handleSyncNow}>
            Sync Now
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

*Document continues with detailed specifications for remaining P0 features...*

*Last Updated: February 2026*
