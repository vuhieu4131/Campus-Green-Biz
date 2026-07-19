import React from 'react';
import {
  Search, MessageSquare, User, CheckCircle, Info, FileText, Phone,
  MapPin, Clock, PlusCircle, Star, ExternalLink, ChevronRight,
  AlertTriangle, Bell, Edit, BarChart, Cpu, Copy, Edit2, XCircle,
  Plus, Bookmark, Camera, Settings, ChevronDown, BellOff, ArrowLeft,
  Lock, Users, Heart, Shield, ShoppingBag, ShoppingCart, CheckCircle2, ChevronLeft, Send,
  MoreHorizontal, Trash2, Award, Gem, Crown, Store
} from 'lucide-react';

interface CustomIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon: string;
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

const CustomIcon: React.FC<CustomIconProps> = ({ icon, className, size = 24, style, ...rest }) => {
  const iconMap: Record<string, React.ReactNode> = {
    'zi-search': <Search size={size} />,
    'zi-shopping-bag': <ShoppingBag size={size} />,
    'zi-cart': <ShoppingCart size={size} />,
    'zi-check-circle-2': <CheckCircle2 size={size} />,
    'zi-chat': <MessageSquare size={size} />,
    'zi-user': <User size={size} />,
    'zi-check-circle-solid': <CheckCircle size={size} fill="currentColor" />,
    'zi-info-circle-solid': <Info size={size} fill="currentColor" />,
    'zi-note': <FileText size={size} />,
    'zi-call': <Phone size={size} />,
    'zi-user-circle': <User size={size} />,
    'zi-location': <MapPin size={size} />,
    'zi-clock-1': <Clock size={size} />,
    'zi-plus-circle': <PlusCircle size={size} />,
    'zi-star': <Star size={size} />,
    'zi-share-external-1': <ExternalLink size={size} />,
    'zi-clock-2': <Clock size={size} />,
    'zi-chevron-right': <ChevronRight size={size} />,
    'zi-chevron-left': <ChevronLeft size={size} />,
    'zi-warning-solid': <AlertTriangle size={size} fill="currentColor" />,
    'zi-notif': <Bell size={size} />,
    'zi-edit-text': <Edit size={size} />,
    'zi-poll': <BarChart size={size} />,
    'zi-check-circle': <CheckCircle size={size} />,
    'zi-memory': <Cpu size={size} />,
    'zi-poll-solid': <BarChart size={size} fill="currentColor" />,
    'zi-copy': <Copy size={size} />,
    'zi-edit': <Edit2 size={size} />,
    'zi-close-circle': <XCircle size={size} />,
    'zi-plus': <Plus size={size} />,
    'zi-warning': <AlertTriangle size={size} />,
    'zi-info-circle': <Info size={size} />,
    'zi-star-solid': <Star size={size} fill="currentColor" />,
    'zi-bookmark': <Bookmark size={size} />,
    'zi-camera': <Camera size={size} />,
    'zi-setting': <Settings size={size} />,
    'zi-chevron-down': <ChevronDown size={size} />,
    'zi-notif-off': <BellOff size={size} />,
    'zi-arrow-left': <ArrowLeft size={size} />,
    'zi-lock': <Lock size={size} />,
    'zi-group': <Users size={size} />,
    'zi-heart': <Heart size={size} />,
    'zi-heart-solid': <Heart size={size} fill="currentColor" />,
    'zi-share': <ExternalLink size={size} />,
    'zi-send-solid': <Send size={size} />,
    'zi-more-horiz': <MoreHorizontal size={size} />,
    'zi-delete': <Trash2 size={size} />,
    'zi-shield-solid': <Award size={size} fill="currentColor" />,
    'zi-diamond': <Gem size={size} />,
    'zi-diamond-solid': <Crown size={size} fill="currentColor" />,
    'zi-store': <Store size={size} />
  };

  const renderedIcon = iconMap[icon] || <Shield size={size} />; // fallback

  return (
    <span {...rest} className={`inline-flex items-center justify-center ${className || ''}`} style={style}>
      {renderedIcon}
    </span>
  );
};

export default CustomIcon;
