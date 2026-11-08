import type { Lang } from '../store/langStore'
import { ar } from './dict_ar_en'

const dict: Record<Lang, Record<string, string>> = {
  ar,
  en: {
    dashboard: 'Dashboard',
    products: 'Products',
    pos: 'Point of Sale',
    tables: 'Tables',
    kitchen: 'Kitchen',
    inventory: 'Inventory',
    recipes: 'Recipes',
    purchases: 'Purchases',
    customers: 'Customers',
    employees: 'Employees',
    finance: 'Finance',
    reports: 'Reports',
    settings: 'Settings',
    users: 'Users',
    logout: 'Logout',
    search: 'Search...',
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
    loading: 'Loading...',
    noData: 'No data',
    total: 'Total',
    actions: 'Actions',
    status: 'Status',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    todaySales: 'Today Sales',
    todayOrders: 'Today Orders',
    monthSales: 'Month Sales',
    netProfit: 'Net Profit',
    language: 'Language',
  },
}

export function t(key: string, lang: Lang): string {
  return dict[lang]?.[key] || key
}