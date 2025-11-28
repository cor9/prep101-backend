# Promo Code System

## Overview

The PREP101 promo code system enables controlled distribution of free guides through redeemable codes instead of automatic monthly free guides. This provides better tracking, anti-abuse controls, and flexibility for marketing campaigns.

## Key Changes from Previous System

### Before (Old System)
- Free tier: Automatic 1 guide per month
- `User.guidesLimit` defaulted to `1` for free users
- No tracking of how users got their free guides

### After (New System)
- Free tier: 0 guides by default (must use promo codes)
- `User.guidesLimit` defaults to `0` for free users
- Complete tracking of promo code redemptions
- Admin control over code creation and deactivation

## Database Schema

### PromoCode Model

```javascript
{
  id: UUID,
  code: STRING (unique, uppercase),
  description: STRING,
  type: ENUM('free_guides', 'discount', 'upgrade'),
  guidesGranted: INTEGER (default: 1),
  discountPercent: INTEGER,
  maxRedemptions: INTEGER (null = unlimited),
  currentRedemptions: INTEGER,
  maxRedemptionsPerUser: INTEGER (default: 1),
  isActive: BOOLEAN,
  expiresAt: DATE,
  startsAt: DATE,
  createdBy: UUID (admin user),
  notes: TEXT
}
```

### PromoCodeRedemption Model

```javascript
{
  id: UUID,
  promoCodeId: UUID (FK),
  userId: UUID (FK),
  guidesGranted: INTEGER,
  discountPercent: INTEGER,
  redeemedAt: DATE,
  expiresAt: DATE,
  isUsed: BOOLEAN,
  usedAt: DATE
}
```

## API Endpoints

### User Endpoints

#### Redeem Promo Code
```http
POST /api/promo-codes/redeem
Authorization: Bearer <token>

{
  "code": "WELCOME2024"
}

Response:
{
  "success": true,
  "message": "Promo code redeemed successfully! You received 1 free guide",
  "redemption": {
    "id": "...",
    "guidesGranted": 1,
    "redeemedAt": "2025-11-28T..."
  },
  "user": {
    "guidesLimit": 1,
    "guidesUsed": 0,
    "guidesRemaining": 1
  }
}
```

#### Get My Redemptions
```http
GET /api/promo-codes/my-redemptions
Authorization: Bearer <token>

Response:
{
  "success": true,
  "redemptions": [...],
  "total": 2
}
```

### Admin Endpoints

#### Create Promo Code
```http
POST /api/promo-codes/create
Authorization: Bearer <admin-token>

{
  "code": "BLACKFRIDAY2024",
  "description": "Black Friday Special",
  "type": "free_guides",
  "guidesGranted": 3,
  "maxRedemptions": 500,
  "maxRedemptionsPerUser": 1,
  "expiresAt": "2024-11-30T23:59:59Z"
}

Response:
{
  "success": true,
  "message": "Promo code created successfully",
  "promoCode": {...}
}
```

#### List All Codes
```http
GET /api/promo-codes/admin/all?includeInactive=false
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "promoCodes": [...],
  "total": 15
}
```

#### Deactivate Code
```http
PUT /api/promo-codes/admin/:id/deactivate
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "Promo code deactivated successfully",
  "promoCode": {...}
}
```

#### Get Code Redemptions
```http
GET /api/promo-codes/admin/:id/redemptions
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "redemptions": [...],
  "total": 47
}
```

## Migration

### Run Database Migration

```bash
node scripts/migrate-promo-codes.js
```

This will:
1. Create `PromoCodes` and `PromoCodeRedemptions` tables
2. Update existing free users from `guidesLimit: 1` to `guidesLimit: 0`
3. Create a sample promo code `WELCOME2024` for testing

### Manual SQL (if needed)

```sql
-- Update existing free users
UPDATE "Users"
SET "guidesLimit" = 0
WHERE "subscription" = 'free'
AND "guidesLimit" = 1;
```

## Usage Examples

### Creating Campaign Codes

```javascript
// Influencer code - 100 redemptions, 2 free guides each
{
  code: "ACTOR123",
  description: "Actor XYZ's promo code",
  type: "free_guides",
  guidesGranted: 2,
  maxRedemptions: 100,
  maxRedemptionsPerUser: 1
}

// Holiday promotion - 1000 redemptions, 1 free guide
{
  code: "HOLIDAY2024",
  description: "Holiday special",
  type: "free_guides",
  guidesGranted: 1,
  maxRedemptions: 1000,
  maxRedemptionsPerUser: 1,
  expiresAt: "2024-12-31T23:59:59Z"
}

// Early access - unlimited redemptions, starts in future
{
  code: "EARLYACCESS",
  description: "Early access beta",
  type: "free_guides",
  guidesGranted: 5,
  maxRedemptions: null, // unlimited
  startsAt: "2025-01-01T00:00:00Z",
  expiresAt: "2025-01-31T23:59:59Z"
}
```

### Admin Access

Admins are determined by:
1. User email matches `process.env.OWNER_EMAIL`, OR
2. User has `betaAccessLevel === 'admin'`

## Security & Validation

### Code Validation Rules
- Codes must be 3-50 characters
- Automatically converted to uppercase
- Must be unique
- Cannot be redeemed if:
  - Code is inactive
  - Code has expired
  - Code not yet started
  - Max redemptions reached
  - User already redeemed (if single use)

### Error Handling

```javascript
// Invalid code
{ success: false, message: "Invalid promo code" }

// Already redeemed
{ success: false, message: "You have already redeemed this code (limit: 1 per user)" }

// Expired
{ success: false, message: "Promo code has expired" }

// Max redemptions reached
{ success: false, message: "Promo code has reached maximum redemptions" }
```

## Frontend Integration

### Redemption UI Example

```jsx
function PromoCodeInput() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRedeem = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/promo-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ code: code.toUpperCase() })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Success! You received ${data.redemption.guidesGranted} free guide(s)`);
        // Update user's guide count in UI
      } else {
        setMessage(data.message);
      }
    } catch (error) {
      setMessage('Failed to redeem code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Enter promo code"
      />
      <button onClick={handleRedeem} disabled={loading}>
        {loading ? 'Redeeming...' : 'Redeem'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
```

## Monitoring & Analytics

### Track Code Performance

```javascript
// Get redemptions for a specific code
const redemptions = await PromoCodeRedemption.findAll({
  where: { promoCodeId: codeId },
  include: [{ model: User, attributes: ['email', 'createdAt'] }]
});

// Calculate conversion rate
const redemptionCount = redemptions.length;
const usersWhoGenerated = redemptions.filter(r => r.isUsed).length;
const conversionRate = (usersWhoGenerated / redemptionCount) * 100;
```

### Useful Queries

```javascript
// Most popular codes
const popularCodes = await PromoCode.findAll({
  order: [['currentRedemptions', 'DESC']],
  limit: 10
});

// Codes expiring soon
const expiringCodes = await PromoCode.findAll({
  where: {
    isActive: true,
    expiresAt: {
      [Op.between]: [new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    }
  }
});

// Inactive codes never used
const unusedCodes = await PromoCode.findAll({
  where: {
    currentRedemptions: 0,
    isActive: false
  }
});
```

## Best Practices

1. **Code Naming**: Use memorable, campaign-specific codes
2. **Limits**: Always set `maxRedemptionsPerUser` to prevent abuse
3. **Expiration**: Set expiration dates for time-limited campaigns
4. **Tracking**: Use `notes` field to track campaign source
5. **Deactivation**: Deactivate instead of delete codes with redemptions
6. **Testing**: Use test codes with limited redemptions before major campaigns

## Troubleshooting

### Code not working
1. Check if code is active: `isActive = true`
2. Check expiration: `expiresAt > now`
3. Check start date: `startsAt <= now`
4. Check max redemptions: `currentRedemptions < maxRedemptions`

### User can't redeem
1. Verify user hasn't already redeemed
2. Check user redemption limit
3. Ensure user is authenticated
4. Check code spelling (must be exact match, uppercase)

### Migration issues
1. Ensure database connection is working
2. Check that User model is properly loaded
3. Verify no foreign key conflicts
4. Check for duplicate code errors

## Support

For questions or issues with the promo code system:
1. Check this documentation
2. Review `.cursor/DECISIONS.md` for technical decisions
3. Check migration logs for setup issues
4. Test with `WELCOME2024` sample code

---

**Last Updated**: November 28, 2025
**Version**: 1.0.0
