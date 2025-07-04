// Copyright 2025 @polkadot-cloud/polkadot-staking-dashboard authors & contributors
// SPDX-License-Identifier: GPL-3.0-only

import { createSafeContext, useEffectIgnoreInitial } from '@w3ux/hooks'
import { getStakingChain, getStakingChainData } from 'consts/util'
import { useActiveAccounts } from 'contexts/ActiveAccounts'
import { useApi } from 'contexts/Api'
import { useNetwork } from 'contexts/Network'
import {
  accountBalances$,
  defaultAccountBalance,
  defaultPoolMembership,
  defaultStakingLedger,
  poolMemberships$,
  stakingLedgers$,
} from 'global-bus'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type {
  AccountBalance,
  MaybeAddress,
  PoolMembershipState,
  StakingLedger,
} from 'types'
import type { BalancesContextInterface } from './types'
import { getLocalFeeReserve, setLocalFeeReserve } from './util'

export const [BalancesContext, useBalances] =
  createSafeContext<BalancesContextInterface>()

export const BalancesProvider = ({ children }: { children: ReactNode }) => {
  const { network } = useNetwork()
  const { getChainSpec } = useApi()
  const stakingChain = getStakingChain(network)
  const { activeAddress } = useActiveAccounts()
  const { existentialDeposit } = getChainSpec(stakingChain)
  const { units, defaultFeeReserve } = getStakingChainData(network)

  // Store account balances state
  type StateBalances = Record<string, Record<string, AccountBalance>>
  const [accountBalances, setAccountBalances] = useState<StateBalances>({})

  // Store staking ledgers state
  type StateLedgers = Record<string, StakingLedger>
  const [stakingLedgers, setStakingLedgers] = useState<StateLedgers>({})

  // Store pool memberships state
  type PoolMemberships = Record<string, PoolMembershipState>
  const [poolMemberships, setPoolMemberships] = useState<PoolMemberships>({})

  // A user-configurable reserve amount to be used to pay for transaction fees
  const [feeReserve, setFeeReserve] = useState<bigint>(
    getLocalFeeReserve(activeAddress, defaultFeeReserve, { network, units })
  )

  // Updates account's reserve amount in state and in local storage
  const setFeeReserveBalance = (amount: bigint) => {
    if (!activeAddress) {
      return
    }
    setLocalFeeReserve(activeAddress, amount, network)
    setFeeReserve(amount)
  }

  // Get an account balance for the default network chain
  const getAccountBalance = (address: MaybeAddress) => {
    if (!address) {
      return defaultAccountBalance
    }
    return accountBalances?.[stakingChain]?.[address] || defaultAccountBalance
  }

  // Get an account's ed reserved balance
  const getEdReserved = () => existentialDeposit

  // Get an account's staking ledger
  const getStakingLedger = (address: MaybeAddress) => {
    if (!address) {
      return defaultStakingLedger
    }
    return stakingLedgers?.[address] || defaultStakingLedger
  }

  // Get an account's pool membership
  const getPoolMembership = (address: MaybeAddress): PoolMembershipState => {
    if (!address) {
      return defaultPoolMembership
    }
    return poolMemberships?.[address] || defaultPoolMembership
  }

  // Gets an account's nominations from its staking ledger
  const getNominations = (address: MaybeAddress) => {
    if (!address) {
      return []
    }
    const { nominators } = getStakingLedger(address)
    return nominators?.targets || []
  }

  // Get an account's pending pool rewards from its staking ledger
  const getPendingPoolRewards = (address: MaybeAddress) => {
    if (!address) {
      return 0n
    }
    return getPoolMembership(address).membership?.pendingRewards || 0n
  }

  // Update an account's reserve amount on account or network change
  useEffectIgnoreInitial(() => {
    setFeeReserve(
      getLocalFeeReserve(activeAddress, defaultFeeReserve, { network, units })
    )
  }, [activeAddress, network])

  // Subscribe to global bus account balance events
  useEffect(() => {
    const unsubBalances = accountBalances$.subscribe((result) => {
      setAccountBalances(result)
    })
    const unsubStakingLedgers = stakingLedgers$.subscribe((result) => {
      setStakingLedgers(result)
    })
    const unsubPoolMemberships = poolMemberships$.subscribe((result) => {
      setPoolMemberships(result)
    })
    return () => {
      unsubBalances.unsubscribe()
      unsubStakingLedgers.unsubscribe()
      unsubPoolMemberships.unsubscribe()
    }
  }, [])

  return (
    <BalancesContext.Provider
      value={{
        getAccountBalance,
        getStakingLedger,
        getPoolMembership,
        getNominations,
        getEdReserved,
        getPendingPoolRewards,
        feeReserve,
        setFeeReserveBalance,
      }}
    >
      {children}
    </BalancesContext.Provider>
  )
}
