export const formatNumberParts = (amount: number) => {
    const parts = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    return { integer: parts[0], decimal: parts[1] || '00' };
};