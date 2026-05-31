import React from 'react';

export interface BillData {
  tenantName: string;
  flatNumber: string;
  month: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  electricityCharge: number;
  waterCharge: number;
  motorCharge: number;
  motorChargeRule: 'add' | 'deduct' | 'none';
  maintenanceCharge: number;
  totalAmount: number;
}

/**
 * Generates a high-quality receipt image using HTML5 Canvas
 * Returns a Promise that resolves to a PNG Blob
 */
export const generateBillReceiptBlob = (data: BillData): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get 2D context'));
      return;
    }

    // Set canvas dimensions (Double resolution for crispness on high-DPI screens / WhatsApp)
    const scale = 2;
    const width = 450;
    const height = 620;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // --- DRAWING THE RECEIPT ---

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw subtle border around the whole receipt
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // 2. Header Gradient Block
    const gradient = ctx.createLinearGradient(12, 12, width - 12, 12);
    gradient.addColorStop(0, '#6d28d9'); // Indigo 700
    gradient.addColorStop(1, '#4f46e5'); // Violet 600
    ctx.fillStyle = gradient;
    ctx.fillRect(12, 12, width - 24, 75);

    // Header Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Month / Title
    ctx.font = '800 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${data.month.toUpperCase()} UTILITY BILL`, width / 2, 42);
    
    ctx.font = '500 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#c7d2fe';
    ctx.fillText('GURUGRAM 1562 - ELECTRICITY & WATER STATEMENT', width / 2, 60);

    // 3. Receipt Details Card
    ctx.fillStyle = '#f8fafc'; // light gray background for tenant details card
    ctx.fillRect(25, 105, width - 50, 75);
    
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(25, 105, width - 50, 75);

    // Tenant info text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '800 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(data.tenantName, 35, 125);
    
    ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Flat: ${data.flatNumber}`, 35, 142);
    ctx.fillText(`Bill Generated: ${new Date().toLocaleDateString('en-IN')}`, 35, 160);

    // Statement / Invoice ID
    ctx.textAlign = 'right';
    const invoiceId = `INV-${data.month.replace(' ', '').substring(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    ctx.fillText(invoiceId, width - 35, 125);
    ctx.fillText('Status: UNPAID', width - 35, 142);

    // 4. Line Items Grid
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('DESCRIPTION', 25, 210);
    
    ctx.textAlign = 'right';
    ctx.fillText('AMOUNT', width - 25, 210);

    // Table Header Divider
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(25, 218);
    ctx.lineTo(width - 25, 218);
    ctx.stroke();

    let currentY = 240;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#e2e8f0';

    const drawRow = (label: string, subLabel: string, amountStr: string, isTotal = false) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = isTotal ? '#1e1b4b' : '#1e293b';
      ctx.font = isTotal 
        ? '800 13px "Plus Jakarta Sans", system-ui, sans-serif'
        : '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(label, 25, currentY);

      if (subLabel) {
        ctx.font = '400 10px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(subLabel, 25, currentY + 14);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = isTotal ? '#4f46e5' : '#0f172a';
      ctx.font = isTotal 
        ? '800 14px "Plus Jakarta Sans", system-ui, sans-serif'
        : '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(amountStr, width - 25, currentY + (subLabel ? 5 : 0));

      currentY += subLabel ? 36 : 28;

      // Draw thin separator line
      if (!isTotal) {
        ctx.beginPath();
        ctx.moveTo(25, currentY - 8);
        ctx.lineTo(width - 25, currentY - 8);
        ctx.stroke();
      }
    };

    // Row 1: Electricity Reading Detail
    const elecDetail = `Reading: ${data.previousReading} to ${data.currentReading} (${data.unitsConsumed} Units @ ₹${data.ratePerUnit})`;
    drawRow('Electricity Charges', elecDetail, `₹${data.electricityCharge.toFixed(2)}`);

    // Row 2: Water Charges
    drawRow('Water Charges (Fixed)', '', `₹${data.waterCharge.toFixed(2)}`);

    // Row 3: Motor Charges
    if (data.motorChargeRule === 'deduct') {
      drawRow('Motor Charges (Deduction)', 'Motor running on tenant meter (Deducted)', `-₹${data.motorCharge.toFixed(2)}`);
    } else if (data.motorChargeRule === 'add') {
      drawRow('Motor Charges (Fixed)', 'Water pump maintenance contribution', `₹${data.motorCharge.toFixed(2)}`);
    }

    // Row 4: Maintenance Charges (if any)
    if (data.maintenanceCharge > 0) {
      drawRow('Maintenance Charges', 'Monthly apartment maintenance', `₹${data.maintenanceCharge.toFixed(2)}`);
    }

    // Adjust for total
    currentY += 10;

    // 5. Total Block
    // Draw total background card
    ctx.fillStyle = '#f5f3ff'; // Light violet tint
    ctx.fillRect(25, currentY - 10, width - 50, 45);
    
    ctx.strokeStyle = '#c7d2fe';
    ctx.strokeRect(25, currentY - 10, width - 50, 45);

    drawRow('TOTAL AMOUNT DUE', 'Payable immediately via UPI / Cash', `₹${data.totalAmount.toFixed(2)}`, true);

    // 6. Payment/Footer Info
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Please scan landlord UPI or pay directly to Account.', width / 2, height - 70);
    ctx.fillText('Kindly share transaction screenshot once payment is completed.', width / 2, height - 55);

    // Decorative receipt cut-out effect at bottom
    ctx.fillStyle = '#ffffff';
    const triangleWidth = 10;
    const triangleHeight = 6;
    for (let x = 12; x < width - 12; x += triangleWidth) {
      ctx.beginPath();
      ctx.moveTo(x, height - 12);
      ctx.lineTo(x + triangleWidth / 2, height - 12 - triangleHeight);
      ctx.lineTo(x + triangleWidth, height - 12);
      ctx.closePath();
      ctx.fill();
    }

    // Seal / Signature block
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4f46e5';
    ctx.font = '700 9px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('AUTHORIZED STATEMENT', width - 35, height - 35);

    // Output to blob
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob returned null'));
      }
    }, 'image/png');
  });
};

interface ReceiptPreviewProps {
  data: BillData;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ data }) => {
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    setLoading(true);
    generateBillReceiptBlob(data)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error rendering receipt preview:', err);
        setLoading(false);
      });
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
        Generating digital receipt preview...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {imgUrl && (
        <img 
          src={imgUrl} 
          alt="Generated Receipt Preview" 
          style={{ 
            maxWidth: '100%', 
            borderRadius: 'var(--radius-sm)', 
            boxShadow: 'var(--glass-shadow)',
            border: '1px solid var(--card-border)',
            backgroundColor: '#ffffff'
          }} 
        />
      )}
    </div>
  );
};
