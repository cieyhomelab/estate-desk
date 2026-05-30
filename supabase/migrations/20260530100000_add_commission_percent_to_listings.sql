-- Add commission_percent to listings: per-listing agent commission rate
alter table listings
  add column commission_percent numeric(5,2)
    check (commission_percent > 0 and commission_percent <= 100);
