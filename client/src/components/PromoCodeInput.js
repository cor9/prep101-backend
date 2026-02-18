import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../config/api';

const PromoCodeInput = ({ onRedeemSuccess }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const handleRedeem = async (e) => {
        e.preventDefault();

        if (!code.trim()) {
            toast.error('Please enter a promo code');
            return;
        }

        setLoading(true);

        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(user?.accessToken || user?.token ? { 'Authorization': `Bearer ${user.accessToken || user.token}` } : {})
            };

            const res = await fetch(`${API_BASE}/api/promo-codes/redeem`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ code: code.trim() })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to redeem code');
            }

            toast.success(data.message || 'Promo code redeemed successfully!');
            setCode('');

            // Trigger refresh of user data/limits
            if (onRedeemSuccess) {
                onRedeemSuccess();
            }

        } catch (error) {
            console.error('Redeem error:', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card-white" style={{ marginTop: '1rem', padding: '1.5rem' }}>
            <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#374151',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                🎟️ Redeem Promo Code
            </h3>
            <form onSubmit={handleRedeem} style={{ display: 'flex', gap: '1rem' }}>
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. SUMMER2024)"
                    className="form-input"
                    style={{ flex: 1, textTransform: 'uppercase' }}
                    disabled={loading}
                />
                <button
                    type="submit"
                    className="btn btnPrimary"
                    disabled={loading || !code.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {loading ? 'Redeeming...' : 'Apply Code'}
                </button>
            </form>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                Got a valid class code? Enter it here to unlock free guides.
            </p>
        </div>
    );
};

export default PromoCodeInput;
