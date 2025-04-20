// [unchanged imports and setup...]

              <div style={{ marginTop: 20 }}>
                {client && <p><strong>Selected Client:</strong> {client.name}</p>}

                <button
                  onClick={() => {
                    setShowInputFor(prev => ({ ...prev, [meeting.id]: true }));
                    setShowDropdownFor(prev => ({ ...prev, [meeting.id]: false }));
                  }}
                  style={{ marginRight: 10 }}
                >
                  Create New Client
                </button>

                {showInputFor[meeting.id] ? null : (
                  <button
                    onClick={() => {
                      setShowDropdownFor(prev => ({ ...prev, [meeting.id]: true }));
                      setShowInputFor(prev => ({ ...prev, [meeting.id]: false }));
                    }}
                  >
                    Assign to Existing Client
                  </button>
                )}

                {showInputFor[meeting.id] && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      placeholder="Client name"
                      value={newClientNames[meeting.id] || ''}
                      onChange={e =>
                        setNewClientNames(prev => ({ ...prev, [meeting.id]: e.target.value }))
                      }
                      style={{ padding: '6px', marginRight: 10 }}
                    />
                    <button onClick={() => handleCreateClient(meeting.id)}>Create & Assign</button>
                  </div>
                )}

                {showDropdownFor[meeting.id] && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      list={`clients-${meeting.id}`}
                      placeholder="Search client..."
                      onChange={e => {
                        const selectedName = e.target.value;
                        const selectedClient = clients.find(c => c.name === selectedName);
                        if (selectedClient) {
                          setClientSelections(prev => ({ ...prev, [meeting.id]: selectedClient.id }));
                        }
                      }}
                      style={{ padding: '6px 10px', marginRight: 10 }}
                    />
                    <datalist id={`clients-${meeting.id}`}>
                      {clients.map(client => (
                        <option key={client.id} value={client.name} />
                      ))}
                    </datalist>
                    <button onClick={() => handleAssignExistingClient(meeting.id)}>Assign</button>
                  </div>
                )}

                {clientId && client && (
                  <div style={{ marginTop: 20 }}>
                    <p><strong>Assign Opportunity:</strong></p>
                    {!showInputFor[meeting.id] && (
                      <>
                        <select
                          value={opportunitySelections[meeting.id] || ''}
                          onChange={e =>
                            setOpportunitySelections(prev => ({ ...prev, [meeting.id]: e.target.value }))
                          }
                          style={{ padding: '6px', marginRight: 10 }}
                        >
                          <option value="">Select opportunity</option>
                          {clientOpportunities.map(op => (
                            <option key={op.id} value={op.id}>{op.name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAssignOpportunity(meeting.id)}>Assign</button>
                      </>
                    )}

                    <div style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        placeholder="New opportunity name"
                        value={newOpportunityNames[meeting.id] || ''}
                        onChange={e =>
                          setNewOpportunityNames(prev => ({ ...prev, [meeting.id]: e.target.value }))
                        }
                        style={{ padding: '6px', marginRight: 10 }}
                      />
                      <button onClick={() => handleCreateOpportunity(meeting.id, clientId)}>
                        Create & Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
