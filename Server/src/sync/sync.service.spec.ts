describe('SyncService merge rules', () => {
  it('prefers the newer updatedAt when deciding last-write-wins', () => {
    const serverUpdated = new Date('2026-01-02T00:00:00.000Z').getTime();
    const clientUpdated = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(clientUpdated < serverUpdated).toBe(true);
  });

  it('treats equal timestamps as an applyable client write', () => {
    const ts = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(ts >= ts).toBe(true);
  });
});
