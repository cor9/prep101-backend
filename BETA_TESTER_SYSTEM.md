# PREP101 Beta Tester System

## 🎯 Overview

The PREP101 Beta Tester System allows you to invite and manage beta testers for your platform before public launch. Beta testers get extended access, early feature previews, and help you validate your system.

## 🔐 Beta Tester Access Levels

### **Early Beta Tester**
- **Guides Limit**: 25 per month (vs 1 for free users)
- **Features**: Early access + Priority support
- **Best For**: General testing and feedback

### **Premium Beta Tester**
- **Guides Limit**: 100 per month
- **Features**: Early access + Priority support + Advanced RAG + Bulk generation
- **Best For**: Power users and detailed testing

### **Admin Beta Tester**
- **Guides Limit**: Unlimited (999)
- **Features**: All beta features + Custom methodology + Advanced analytics + API access
- **Best For**: Core team members and advanced testing

## 🚀 Getting Started

### 1. Create Your First Admin Beta Tester

You'll need to manually create an admin beta tester in the database first:

```sql
-- Run this in your PostgreSQL database
UPDATE "Users" 
SET 
  "isBetaTester" = true,
  "betaAccessLevel" = 'admin',
  "betaStatus" = 'active',
  "betaStartedAt" = NOW(),
  "betaFeatures" = '["early-access", "priority-support", "advanced-rag", "bulk-guide-generation", "custom-methodology", "advanced-analytics", "api-access"]'
WHERE email = 'your-email@example.com';
```

### 2. Invite Additional Beta Testers

Once you have admin access, you can invite others:

```bash
# Invite an early beta tester
curl -X POST http://localhost:5001/api/beta/invite \
  -H "Authorization: Bearer <your-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tester@example.com",
    "name": "Beta Tester",
    "accessLevel": "early"
  }'
```

## 📊 Beta Tester Management

### **Admin Endpoints** (Admin Beta Testers Only)

#### Invite New Beta Tester
```bash
POST /api/beta/invite
{
  "email": "user@example.com",
  "name": "User Name",
  "accessLevel": "early|premium|admin",
  "features": ["feature1", "feature2"] // Optional custom features
}
```

#### View All Beta Testers
```bash
GET /api/beta/testers?status=active
```

#### Get Beta Tester Statistics
```bash
GET /api/beta/stats
```

#### Update Beta Tester Access
```bash
PUT /api/beta/testers/:id/access
{
  "accessLevel": "premium",
  "features": ["advanced-rag", "bulk-guide-generation"]
}
```

#### End Beta Testing for User
```bash
POST /api/beta/testers/:id/end
```

### **Beta Tester Endpoints** (All Beta Testers)

#### Get Beta Dashboard
```bash
GET /api/beta/dashboard
```

#### Submit Feedback
```bash
POST /api/beta/feedback
{
  "feedback": "This feature is amazing! Here are some suggestions..."
}
```

#### Check Feature Access
```bash
GET /api/beta/check-access/advanced-rag
```

### **Public Endpoints** (No Auth Required)

#### Check Invitation Status
```bash
GET /api/beta/invitation-status?email=user@example.com
```

#### View Available Beta Features
```bash
GET /api/beta/features
```

## 🎭 Beta Features

### **Core Features**
- **Early Access**: Try features before public release
- **Priority Support**: Get help faster during beta

### **Advanced Features** (Premium+)
- **Advanced RAG**: Enhanced methodology search
- **Bulk Guide Generation**: Create multiple guides at once

### **Admin Features** (Admin Only)
- **Custom Methodology**: Upload custom methodology files
- **Advanced Analytics**: Detailed performance insights
- **API Access**: Direct API integration capabilities

## 🔄 Beta Tester Lifecycle

### 1. **Invitation**
- Admin invites user via email
- User receives invitation with temporary password
- User account marked as `betaStatus: 'invited'`

### 2. **Activation**
- User logs in for the first time
- System automatically activates beta tester
- `betaStatus` changes to `'active'`
- Extended guides limit applied

### 3. **Active Testing**
- User has full beta access
- Can submit feedback and report issues
- Extended guides limit in effect

### 4. **Completion**
- Admin can end beta testing for any user
- User reverts to standard free account
- `betaStatus` changes to `'completed'`

## 📈 Beta Testing Workflow

### **Phase 1: Core Team (Admin Beta Testers)**
- Test all features internally
- Validate system stability
- Set up beta testing processes

### **Phase 2: Early Adopters (Early Beta Testers)**
- Invite trusted users
- Test core functionality
- Gather initial feedback

### **Phase 3: Power Users (Premium Beta Testers)**
- Invite experienced users
- Test advanced features
- Validate performance under load

### **Phase 4: Public Launch**
- End beta testing for all users
- Transition to regular subscription model
- Launch with validated features

## 🛠️ Integration Examples

### **Frontend Beta Tester Dashboard**
```javascript
const fetchBetaDashboard = async () => {
  const response = await fetch('/api/beta/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (data.isBetaTester) {
    // Show beta tester specific UI
    setBetaFeatures(data.betaFeatures);
    setBetaAccessLevel(data.betaAccessLevel);
  }
};
```

### **Feature Access Control**
```javascript
const checkFeatureAccess = async (featureName) => {
  const response = await fetch(`/api/beta/check-access/${featureName}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (data.hasAccess) {
    // Enable feature for user
    enableAdvancedFeature();
  }
};
```

### **Admin Beta Management**
```javascript
const inviteBetaTester = async (email, name, accessLevel) => {
  const response = await fetch('/api/beta/invite', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, name, accessLevel })
  });
  
  const result = await response.json();
  if (result.temporaryPassword) {
    // Send invitation email with temporary password
    sendInvitationEmail(email, result.temporaryPassword);
  }
};
```

## 📋 Best Practices

### **For Admins**
1. **Start Small**: Begin with 5-10 early beta testers
2. **Clear Communication**: Set expectations for feedback and testing
3. **Regular Check-ins**: Monitor beta tester activity and engagement
4. **Gradual Rollout**: Add features incrementally based on feedback

### **For Beta Testers**
1. **Regular Testing**: Use the system consistently during beta
2. **Detailed Feedback**: Report bugs and suggest improvements
3. **Real-world Usage**: Test with actual acting scenarios
4. **Communication**: Stay in touch with the development team

## 🔒 Security Considerations

- **Beta Access**: Limited to invited users only
- **Feature Gates**: Beta features are properly controlled
- **Data Isolation**: Beta testers can't access other users' data
- **Admin Controls**: Only admin beta testers can manage the system

## 🚀 Deployment

The beta tester system is ready for production use. Key benefits:

- **Controlled Rollout**: Test features with select users
- **Feedback Collection**: Gather insights before public launch
- **Quality Assurance**: Validate system under real usage
- **User Engagement**: Build excitement and community before launch

## 📞 Support

For questions about the beta tester system:

1. Check the API documentation
2. Review the beta tester lifecycle
3. Test with a small group first
4. Monitor system logs for any issues

The beta tester system provides a professional way to validate PREP101 before public launch while building an engaged community of early adopters! 🎭✨
