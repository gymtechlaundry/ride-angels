-- Ensure creator flag is set even when profiles.email is empty but Auth email matches.
update public.profiles p
set is_app_creator = true
from auth.users u
where u.id = p.auth_user_id
  and (
    lower(coalesce(p.email, '')) in ('devin@hyperionappstudio.com')
    or lower(coalesce(u.email, '')) in ('devin@hyperionappstudio.com')
  );
