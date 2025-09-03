import { describe, it, expect } from 'vitest'
import { setStorage, DownwardMessage, } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing'
import { setupContext, testingPairs} from '@acala-network/chopsticks-testing'
import { connectVertical, connectParachains } from '@acala-network/chopsticks'


const { check, checkSystemEvents, checkUmp, checkHrmp } = withExpect(expect);


import networks, { type Network } from './networks.js'

const downwardMessages: DownwardMessage[] = [
  {
    sentAt: 1,
    msg: '0x0210010400010000078155a74e390a1300010000078155a74e39010300286bee0d01000400010100c0cbffafddbe39f71f0190c2369adfc59eaa4c81a308ebcad88cdd9c400ba57c',
  },
]

describe('XCM', async () => {
  let frequency: Network
  let polkadot: Network
  let assetHub: Network
  let networksD: Network

  beforeEach(async () => {
    frequency = await networks.frequency()
    // networksD = await networks.network()
    assetHub = await networks.assetHub()

    polkadot = await networks.polkadot()

    return async () => {
      await frequency.teardown()
      await polkadot.teardown()
    }
  })

  // it('Frequency handles downward messages', async () => {
  //   console.log('Creating new block with downward messages...')
  //   await frequency.chain.newBlock({ downwardMessages })
    
  //   console.log('Checking system events...')
  //   const events = await frequency.api.query.system.events()
  //   console.log('Raw system events:', JSON.stringify(events.toHuman(), null, 2))

    
  //   await checkSystemEvents(frequency).toMatchSnapshot()
  // })

  it('Polkadot send downward messages to frequency', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice } = testingPairs()

    polkadot.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
    })

    await polkadot.api.tx.xcmPallet
      .reserveTransferAssets(
        { V0: { X1: { Parachain: 2000 } } },
        {
          V0: {
            X1: {
              AccountId32: {
                network: 'Any',
                id: alice.addressRaw,
              },
            },
          },
        },
        {
          V0: [
            {
              ConcreteFungible: { id: 'Null', amount: 100e10 },
            },
          ],
        },
        0,
      )
      .signAndSend(alice)

    await polkadot.chain.newBlock()
    await checkSystemEvents(polkadot).toMatchSnapshot()

      console.log('taco-Frequency Events:')
    let result = await checkSystemEvents(polkadot).value();

    // let upward = await checkUmp(polkadot).value();
    // console.log('taco-Upward:', upward)
    
    result.map((event: any) => {
      console.log('taco-Event:', event)
      // console.log('taco-Event:', JSON.stringify(event.toHuman(), null, 2))
    });

      console.log('taco-Frequency Events After New Block:')
    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot()
  })

  it('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice } = testingPairs()

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 10e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
    })

    await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address)).toMatchSnapshot()

    // await frequency.api.tx.xTokens
    //   .transfer(
    //     {
    //       Token: 'DOT',
    //     },
    //     10e10,
    //     {
    //       V1: {
    //         parents: 1,
    //         interior: {
    //           X1: {
    //             AccountId32: {
    //               network: 'Any',
    //               id: alice.addressRaw,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       Unlimited: null,
    //     },
    //   )
    //   .signAndSend(alice)

    // await frequency.chain.newBlock()
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await check(frequency.api.query.tokens.accounts(alice.address, { token: 'DOT' })).toMatchSnapshot()

    // await polkadot.chain.newBlock()

    // await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    // await checkSystemEvents(polkadot).toMatchSnapshot()
  })

  it.only("frequency send horizontal messages to AssetHub", async () => {
    await connectParachains([frequency.chain, assetHub.chain])

    const { alice } = testingPairs()
    
    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Asset: [[
          [{parents: 1, interior: "Here"}],
          {supply: 1000e10, owner: alice.address}
        ]],
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 12e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
    })

    // await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot()
    // await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot()
    const balance = await frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address);
    console.log('alice foreign assets balance:', balance.toHuman())
    check(balance).toMatchSnapshot()
  
    try {
    let tx = await frequency.api.tx.polkadotXcm
      .limitedReserveTransferAssets(
        { 
          V3: { 
            parents: 1, 
            interior: { X1: { Parachain: 1000 } } 
          } 
        },
        { 
          V3: { 
            parents: 0, 
            interior: { 
              X1: { 
                AccountId32: { 
                  network: null, 
                  id: alice.addressRaw, 
                } 
              } 
            } 
          } 
        },
        { 
          V3: [
            { 
              id: { 
                Concrete: { 
                  parents: 1, 
                  interior: "Here" 
                } 
              }, 
              fun: { Fungible: 5e10 } 
            }
          ] 
        },
        0,
        'Unlimited'
      )

      // try {
    //   console.log('SUBMITTING=======')
    //   await new Promise(async (resolve, reject) => {
    //     const unsub = await tx.signAndSend(alice, async ({ status, events, dispatchError }) => {
    //       console.log(`Transaction status: ${status.type}`)
    //       console.log('here 1')

    //       if (status.isInvalid) {
    //         console.log('Transaction is INVALID')
    //         unsub()
    //         reject(new Error('Transaction invalid'))
    //       }
    //       console.log('here 2')

    //       if (status.isDropped) {
    //         console.log('X Transaction was DROPPED from pool')
    //         unsub()
    //         reject(new Error('Transaction dropped'))
    //       }
    //       console.log('here 3')

    //       if (status.isReady) {
    //         console.log('Transaction is ready in pool')
    //       }
    //       console.log('here 4')
          
    //       await frequency.chain.newBlock()

    //       if (status.isInBlock) {
    //         console.log('Transaction INCLUDED in block')

    //         if (dispatchError) {
    //           if (dispatchError.isModule) {
    //             const decoded = frequency.api.registry.findMetaError(dispatchError.asModule)
    //             console.log('Dispatch error:', `${decoded.section}.${decoded.name}`)
    //           } else {
    //             console.log('Dispatch error:', dispatchError.toString())
    //           }
    //         }
    //         console.log('here 5')

    //         unsub()
    //         resolve(true)
    //       }
    //     })
    //   })

    // } catch (error: any) {
    //   console.error('Error in transaction flow:', error.message)
    //   console.error('Full error:', error)
    // }
    // console.log('here 6')
    // await assetHub.chain.newBlock()

      
      await tx.signAndSend(alice)

      console.log('=== CHECKING EVENTS ===')
      const events = await frequency.api.query.system.events()
      console.log('Events after simple transaction:', events.length)
      console.log('Events:', JSON.stringify(events, null, 2))

      const success = events.find(({ event }) => event.method === 'ExtrinsicSuccess')
      const failed = events.find(({ event }) => event.method === 'ExtrinsicFailed')

      if (success) {
        console.log('Simple transaction succeeded')
      }
      if (failed) {
        console.log('Simple transaction failed:', failed.event.data.toHuman())
      }
    } catch (error) {
      console.error('Error sending XCM transfer:', error)
      throw error
    }

    // Check HRMP messages BEFORE block creation
    console.log('=== CHECKING HRMP MESSAGES ===')
    const hrmpMessages = await checkHrmp(frequency).value()
    console.log('HRMP Messages:', JSON.stringify(hrmpMessages, null, 2))
    await checkHrmp(frequency).toMatchSnapshot("outbound-hrmp-messages")

    // Check HRMP messages before block creation
    await checkHrmp(frequency).toMatchSnapshot("outbound-hrmp-messages")
    await checkSystemEvents(frequency).toMatchSnapshot('initial-events')

    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot('events-after-sending')
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot('frequency-after-send')


    // Process on destination chain
    await assetHub.chain.newBlock()
    await checkSystemEvents(assetHub).toMatchSnapshot('events-after-receiving')

    // Verify XCM success/failure
    const events = await assetHub.api.query.system.events()
    const xcmResults = events.filter(({ event }) =>
      event.section === 'xcmpQueue' && ['Success', 'Fail'].includes(event.method)
    )
    console.log('XCM Results:', xcmResults.map(e => `${e.event.method}: ${e.event.data}`))

    // final verification
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot("assethub-final-balance")
  
    // await check(frequency.api.query.foreignAssets.account(  { 
    //   parents: 1,
    //   interior: "Here",
    // }, alice.address)).toMatchSnapshot()

  })
})