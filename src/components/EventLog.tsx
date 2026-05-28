interface EventLogProps {
  logs: string[];
}

export function EventLog({ logs }: EventLogProps) {
  return (
    <section className="event-log" aria-label="이벤트 로그">
      <div className="section-heading">
        <p className="panel-label">기록</p>
        <strong>이벤트 로그</strong>
      </div>
      {logs.length === 0 ? (
        <p className="empty-log">아직 이벤트가 없어요.</p>
      ) : (
        <ol>
          {logs.map((log, index) => (
            <li key={`${log}-${index}`}>{log}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
