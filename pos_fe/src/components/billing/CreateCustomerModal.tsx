import React, { useState } from 'react';
import { X } from 'lucide-react';
import { customerService } from '../../service/customerService';
import { Customer } from '../../types';
import { toast } from 'react-toastify';

interface Props {
  phone: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

const DEFAULTS = {
  name: 'Walk-in Customer',
  email: 'walkin@example.com',
  address: 'N/A',
  city: 'Default City',
  state: 'Default State',
  pincode: '000000',
  birthdate: today,
  anniversary: today,
};

const CreateCustomerModal: React.FC<Props> = ({ phone, onClose, onCreated }) => {
  const [form, setForm] = useState({
    phone: phone || '',
    name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    birthdate: '',
    anniversary: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.phone.trim()) {
      toast.error('Phone number is required');
      onClose(); // ✅ Close modal even if validation fails
      return;
    }

    const dataToSubmit = {
      ...DEFAULTS,
      ...Object.fromEntries(
        Object.entries(form).map(([key, val]) => [key, val.trim() || DEFAULTS[key as keyof typeof DEFAULTS] || ''])
      ),
    };

    setLoading(true);
    try {
      const newCustomer = await customerService.create(dataToSubmit);
      toast.success('Customer created successfully!');
      onCreated(newCustomer);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create customer');
    } finally {
      setLoading(false);
      onClose(); // ✅ Always close the modal at the end
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-semibold mb-4">Add New Customer</h2>

        <div className="space-y-4">
          <input
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            className="w-full border px-3 py-2 rounded"
            placeholder="Phone (required)"
          />
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Name (optional)"
          />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Email (optional)"
          />
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Address (optional)"
          />
          <input
            type="text"
            name="city"
            value={form.city}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="City (optional)"
          />
          <input
            type="text"
            name="state"
            value={form.state}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="State (optional)"
          />
          <input
            type="text"
            name="pincode"
            value={form.pincode}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Pincode (optional)"
          />
          <input
            type="date"
            name="birthdate"
            value={form.birthdate}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Birthdate (optional)"
          />
          <input
            type="date"
            name="anniversary"
            value={form.anniversary}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Anniversary (optional)"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700"
        >
          {loading ? 'Saving...' : 'Create Customer'}
        </button>
      </div>
    </div>
  );
};

export default CreateCustomerModal;
