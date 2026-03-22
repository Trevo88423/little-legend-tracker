-- Important Contacts table for medical team, pharmacies, hospitals, etc.
create table if not exists contacts (
  id uuid primary key,
  family_id uuid not null references families(id),
  child_id uuid not null references children(id),
  name text not null,
  role text not null,
  phone text,
  email text,
  location text,
  notes text,
  created_at timestamptz default now()
);

alter table contacts enable row level security;

create policy "Family members can manage contacts"
  on contacts for all
  using (public.user_belongs_to_family(family_id))
  with check (public.user_belongs_to_family(family_id));

alter publication supabase_realtime add table contacts;
