# CCV: Technical Specification - Data Structures

## Outline

## External Data Structures

This section describes external data structures used by the CCV module.

The CCV module uses the ABCI `ValidatorUpdate` data structure, which consists of a validator and its power (for more details, take a look at the [ABCI specification](https://github.com/tendermint/spec/blob/v0.7.1/spec/abci/abci.md#data-types)), i.e.,
```typescript
interface ValidatorUpdate {
  pubKey: PublicKey
  power: int64
}
```
The provider chain sends to the consumer chain a list of `ValidatorUpdate`s, containing an entry for every validator that had its power updated. 

The data structures required for creating clients (i.e., `ClientState`, `ConsensusState`) are defined in [ICS 2](../../core/ics-002-client-semantics). 
In the context of CCV, every chain is uniquely defined by their chain ID and the validator set. 
Thus, CCV requires the `ClientState` to contain the chain ID and the `ConsensusState` for a particular height to contain the validator set at that height. 
In addition, the `ClientState` should contain the `UnbondingPeriod`.
For an example, take a look at the `ClientState` and `ConsensusState` defined in [ICS 7](../../client/ics-007-tendermint-client).

## CCV Data Structures

The CCV module is initialized through the `InitGenesis` method when the chain is first started. The initialization is done from a genesis state. This is the case for both provider and consumer chains:
- On the provider chain, the genesis state is described by the following interface:
  ```typescript
  interface ProviderGenesisState {
    // a list of existing consumer chains
    consumerStates: [ConsumerState]
  }
  ```
  with `ConsumerState` defined as
  ```typescript
  interface ConsumerState {
    chainId: string
    channelId: Identifier
  }
  ```
- On the consumer chain, the genesis state is described by the following interface:
  ```typescript
  interface ConsumerGenesisState {
    providerClientState: ClientState
    providerConsensusState: ConsensusState
    initialValSet: [ValidatorUpdate]
  }
  ```

The provider CCV module handles governance proposals to spawn new consumer chains and to stop existing consumer chains. 
While the structure of governance proposals is specific to every ABCI application (for an example, see the `Proposal` interface in the [Governance module documentation](https://docs.cosmos.network/v0.45/modules/gov/) of Cosmos SDK),
this specification expects the following fields to be part of the proposals to spawn new consumer chains (i.e., `SpawnConsumerChainProposal`) and to stop existing ones (i.e., `StopConsumerChainProposal`):
  ```typescript
  interface SpawnConsumerChainProposal {
    chainId: string
    initialHeight: Height
    spawnTime: Timestamp
    lockUnbondingOnTimeout: Bool
  }
  ```
  - `chainId` is the proposed chain ID of the new consumer chain. It must be different from all other consumer chain IDs of the executing provider chain.
  - `initialHeight` is the proposed initial height of new consumer chain. 
    For an example, take a look at the `Height` defined in [ICS 7](../../client/ics-007-tendermint-client).
  - `spawnTime` is the time on the provider chain at which the consumer chain genesis is finalized and all validators are responsible to start their consumer chain validator node.
  - `lockUnbondingOnTimeout` is a boolean value that indicates whether the funds corresponding to the outstanding unbonding operations are to be released in case of a timeout. In case `lockUnbondingOnTimeout == true`, a governance proposal to stop the timed out consumer chain would be necessary to release the locked funds. 
  ```typescript
  interface StopConsumerChainProposal {
    chainId: string
    stopTime: Timestamp
  }
  ```
  - `chainId` is the chain ID of the consumer chain to be removed. It must be the ID of an existing consumer chain of the executing provider chain.
  - `stopTime` is the time on the provider chain at which all validators are responsible to stop their consumer chain validator node.

During the CCV channel opening handshake, the provider chain adds the address of its distribution module account to the channel version as metadata (as described in [ICS 4](../../core/ics-004-channel-and-packet-semantics/README.md#definitions)). 
The metadata structure is described by the following interface:
```typescript
interface CCVHandshakeMetadata {
  providerDistributionAccount: string // the account's address
  version: string
}
```
This specification assumes that the provider CCV module has access to the address of the distribution module account through the `GetDistributionAccountAddress()` method. For an example, take a look at the [auth module](https://docs.cosmos.network/v0.45/modules/auth/) of Cosmos SDK. 

During the CCV channel opening handshake, the provider chain adds the address of its distribution module account to the channel version as metadata (as described in [ICS 4](../../core/ics-004-channel-and-packet-semantics/README.md#definitions)). 
The metadata structure is described by the following interface:
```typescript
interface CCVHandshakeMetadata {
  providerDistributionAccount: string // the account's address
  version: string
}
```
This specification assumes that the provider CCV module has access to the address of the distribution module account through the `GetDistributionAccountAddress()` method. For an example, take a look at the [auth module](https://docs.cosmos.network/v0.45/modules/auth/) of Cosmos SDK. 

## CCV Packets

The structure of the packets sent through the CCV channel is defined by the `Packet` interface in [ICS 4](../../core/ics-004-channel-and-packet-semantics). 
The following packet data types are required by the CCV module:
- `VSCPacketData` contains a list of validator updates, i.e., 
    ```typescript
    interface VSCPacketData {
      // the id of this VSC
      id: uint64 
      // validator updates
      updates: [ValidatorUpdate]
      // downtime slash requests acknowledgements, 
      // i.e., list of validator addresses
      downtimeSlashAcks: [string]
    }
    ```
- `VSCMaturedPacketData` contains the ID of the VSC that reached maturity, i.e., 
    ```typescript
    interface VSCMaturedPacketData {
      id: uint64 // the id of the VSC that reached maturity
    }
    ```
- `SlashPacketData` contains a request to slash a validator, i.e.,
  ```typescript
    interface SlashPacketData {
      valAddress: string // validator address, i.e., the hash of its public key
      valPower: int64
      vscId: uint64
      downtime: Bool
    }
    ```
> Note that for brevity we use e.g., `VSCPacket` to refer to a packet with `VSCPacketData` as its data.

Packets are acknowledged by the remote side by sending back an `Acknowledgement` that contains either a result (in case of success) or an error (as defined in [ICS 4](../../core/ics-004-channel-and-packet-semantics/README.md#acknowledgement-envelope)). 
The following acknowledgement types are required by the CCV module:
```typescript
type VSCPacketAcknowledgement = VSCPacketSuccess | VSCPacketError;
type VSCMaturedPacketAcknowledgement = VSCMaturedPacketSuccess | VSCMaturedPacketError;
type SlashPacketAcknowledgement = SlashPacketSuccess | SlashPacketError;
type PacketAcknowledgement = PacketSuccess | PacketError; // general ack
```

## CCV State

This section describes the internal state of the CCV module. For simplicity, the state is described by a set of variables; for each variable, both the type and a brief description is provided. In practice, all the state (except for hardcoded constants, e.g., `ProviderPortId`) is stored in a key/value store (KVS). The host state machine provides a KVS interface with three functions, i.e., `get()`, `set()`, and `delete()` (as defined in [ICS 24](../../core/ics-024-host-requirements)).

- `ccvVersion = "ccv-1"` is the CCV expected version. Both the provider and the consumer chains need to agree on this version.
- `zeroTimeoutHeight = {0,0}` is the `timeoutHeight` (as defined in [ICS 4](../../core/ics-004-channel-and-packet-semantics)) used by CCV for sending packets. Note that CCV uses `ccvTimeoutTimestamp` for sending CCV packets and `transferTimeoutTimestamp` for transferring tokens. 
- `ccvTimeoutTimestamp: uint64` is the `timeoutTimestamp` (as defined in [ICS 4](../../core/ics-004-channel-and-packet-semantics)) for sending CCV packets. The CCV protocol is responsible of setting `ccvTimeoutTimestamp` such that the *Correct Relayer* assumption is feasible.
- `transferTimeoutTimestamp: uint64` is the `timeoutTimestamp` (as defined in [ICS 4](../../core/ics-004-channel-and-packet-semantics)) for transferring tokens. 

### State on Provider Chain

- `ProviderPortId = "provider"` is the port ID the provider CCV module is expected to bind to.
- `pendingSpawnProposals: [SpawnConsumerChainProposal]` is a list of pending governance proposals to spawn new consumer chains. 
- `pendingStopProposals: [StopConsumerChainProposal]` is a list of pending governance proposals to stop existing consumer chains. 
  Both lists of pending governance proposals expose the following interface: 
```typescript
  interface [Proposal] {
    // append a proposal to the list; the list is modified
    Append(p: Proposal) 

    // remove a proposal from the list; the list is modified
    Remove(p: Proposal)
  }
  ```
- `lockUnbondingOnTimeout: Map<string, Bool>` is a mapping from consumer chain IDs to the boolean values indicating whether the funds corresponding to the in progress unbonding operations are to be released in case of a timeout.
- `chainToClient: Map<string, Identifier>` is a mapping from consumer chain IDs to the associated client IDs.
- `chainToChannel: Map<string, Identifier>` is a mapping from consumer chain IDs to the CCV channel IDs.
- `channelToChain: Map<Identifier, string>` is a mapping from CCV channel IDs to consumer chain IDs.
- `pendingVSCPackets: Map<string, [VSCPacketData]>` is a mapping from consumer chain IDs to a list of pending `VSCPacketData`s that must be sent to the consumer chain once the CCV channel is established. The map exposes the following interface: 
  ```typescript
  interface Map<string, [VSCPacketData]> {
    // append a VSCPacketData to the list mapped to chainId;
    // the list is modified
    Append(chainId: string, data: VSCPacketData) 

    // remove all the VSCPacketData mapped to chainId;
    // the list is modified
    Remove(chainId: string)
  }
- `vscId: uint64` is a monotonic strictly increasing and positive ID that is used to uniquely identify the VSCs sent to the consumer chains. 
  Note that `0` is used as a special ID for the mapping from consumer heights to provider heights.
- `initialHeights: Map<string, Height>` is a mapping from consumer chain IDs to the heights on the provider chain. 
  For every consumer chain, the mapping stores the height when the CCV channel to that consumer chain is established. 
  Note that the provider validator set at this height matches the validator set at the height when the first VSC is provided to that consumer chain.
  It enables the mapping from consumer heights to provider heights.
- `VSCtoH: Map<uint64, Height>` is a mapping from VSC IDs to heights on the provider chain. It enables the mapping from consumer heights to provider heights, 
  i.e., the voting power at height `VSCtoH[id]` on the provider chain was last updated by the validator updates contained in the VSC with ID `id`.  
- `unbondingOps: Map<uint64, UnbondingOperation>` is a mapping that enables accessing for every unbonding operation the list of consumer chains that are still unbonding. When unbonding operations are initiated, the Staking module calls the `AfterUnbondingInitiated()` [hook](#ccv-pcf-hook-afubopcr1); this leads to the creation of a new `UnbondingOperation`, which is defined as
  ```typescript
  interface UnbondingOperation {
    id: uint64
    // list of consumer chain IDs that are still unbonding
    unbondingChainIds: [string] 
  }
  ```
- `vscToUnbondingOps: Map<(string, uint64), [uint64]>` is a mapping from `(chainId, vscId)` tuples to a list of unbonding operation IDs. 
  It enables the provider CCV module to match a `VSCMaturedPacket{vscId}`, received from a consumer chain with `chainId`, with the corresponding unbonding operations. 
  As a result, `chainId` can be removed from the list of consumer chains that are still unbonding these operations. 
  For more details see how received `VSCMaturedPacket`s [are handled](#ccv-pcf-rcvmat1).
- `downtimeSlashRequests: Map<string, [string]>` is a mapping from `chainId`s to lists of validator addresses, 
  i.e., `downtimeSlashRequests[chainId]` contains all the validator addresses for which the provider chain received slash requests for downtime from the consumer chain with `chainId`.

### State on Consumer Chain

- `ConsumerPortId = "consumer"` is the port ID the consumer CCV module is expected to bind to.
- `consumerUnbondingPeriod: Duration"` is the unbonding period on the consumer chain. 
- `providerClient: Identifier` identifies the client of the provider chain (on the consumer chain) that the CCV channel is build upon.
- `providerChannel: Identifier` identifies the consumer's channel end of the CCV channel.
- `validatorSet: <string, CrossChainValidator>` is a mapping that stores the validators in the validator set of the consumer chain. Each validator is described by a `CrossChainValidator` data structure, which is defined as
  ```typescript
  interface CrossChainValidator {
    address: string // validator address, i.e., the hash of its public key
    power: int64
  }
  ```
- `pendingChanges: [ValidatorUpdate]` is a list of `ValidatorUpdate`s received, but not yet applied to the validator set. 
  It is emptied on every `EndBlock()`. The list exposes the following interface:
  ```typescript
  interface [ValidatorUpdate] {
    // append updates to the list;
    // the list is modified
    Append(updates: [ValidatorUpdate]) 

    // return an aggregated list of updates, i.e., 
    // keep only the latest update per validator;
    // the original list is not modified
    Aggregate(): [ValidatorUpdate]

    // remove all the updates from the list;
    // the list is modified
    RemoveAll()
  }
  ```
- `HtoVSC: Map<Height, uint64>` is a mapping from consumer chain heights to VSC IDs. It enables the mapping from consumer heights to provider heights., i.e.,
  - if `HtoVSC[h] == 0`, then the voting power on the consumer chain at height `h` was setup at genesis during Channel Initialization;
  - otherwise, the voting power on the consumer chain at height `h` was updated by the VSC with ID `HtoVSC[h]`.
- `maturingVSCs: [(uint64, uint64)]` is a list of `(id, ts)` tuples, where `id` is the ID of a VSC received via a `VSCPacket` and `ts` is the timestamp at which the VSC reaches maturity on the consumer chain. 
  The list is used to keep track of when unbonding operations are matured on the consumer chain. It exposes the following interface:
  ```typescript
  interface [(uint64, uint64)] {
    // add a VSC id with its maturity timestamp to the list;
    // the list is modified
    Add(id: uint64, ts: uint64)

    // return the list sorted by the maturity timestamps;
    // the original list is not modified
    SortedByMaturityTime(): [(uint64, uint64)]

    // remove (id, ts) from the list;
    // the list is modified
    Remove(id: uint64, ts: uint64)
  }
  ```
- `pendingSlashRequests: [SlashRequest]` is a list of pending `SlashRequest`s that must be sent to the provider chain once the CCV channel is established. A `SlashRequest` consist of a `SlashPacketData` and a flag indicating whether the request is for downtime slashing. The list exposes the following interface: 
  ```typescript
  interface SlashRequest {
    data: SlashPacketData
    downtime: Bool
  }
  interface [SlashRequest] {
    // append a SlashRequest to the list;
    // the list is modified
    Append(data: SlashRequest) 

    // return the reverse list, i.e., latest SlashRequest first;
    // the original list is not modified
    Reverse(): [SlashRequest]

    // remove all the SlashRequest;
    // the list is modified
    RemoveAll()
  }
  ```
- `outstandingDowntime: <string, Bool>` is a mapping from validator addresses to boolean values. 
  `outstandingDowntime[valAddr] == TRUE` entails that the consumer chain sent a request to slash for downtime the validator with address `valAddr`. 
  `outstandingDowntime[valAddr]` is set to false once the consumer chain receives a confirmation that the downtime slash request was received by the provider chain, i.e., a `VSCPacket` that contains `valAddr` in `downtimeSlashAcks`. 
  The mapping enables the consumer CCV module to avoid sending to the provider chain multiple slashing requests for the same downtime infraction.
- `providerDistributionAccount: string` is the address of the distribution module account on the provider chain. It enables the consumer chain to transfer rewards to the provider chain.
- `distributionChannelId: Identifier` is the ID of the distribution token transfer channel used for sending rewards to the provider chain.
- `BlocksPerDistributionTransfer: int64` is the interval (in number of blocks) between two distribution token transfers. 
- `lastDistributionTransferHeight: Height` is the block height of the last distribution token transfer.
- `ccvAccount: string` is the address of the CCV module account where a fraction of the consumer chain rewards are collected before being transferred to the provider chain. 