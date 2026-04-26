-- Performance indexes for high-traffic query patterns
create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_created_at on sessions(user_id, created_at desc);

create index idx_recordings_user_id on recordings(user_id);
create index idx_recordings_session_id on recordings(session_id);

create index idx_metrics_recording_id on metrics(recording_id);
create index idx_metrics_user_id on metrics(user_id);
create index idx_metrics_user_status on metrics(user_id, analysis_status);

create index idx_milestones_user_id on milestones(user_id);
