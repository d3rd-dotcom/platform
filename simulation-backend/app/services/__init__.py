"""
Service modules
"""

from .ontology_generator import OntologyGenerator
from .graph_builder import GraphBuilderService
from .text_processor import TextProcessor
from .zep_entity_reader import ZepEntityReader, EntityNode, FilteredEntities
from .oasis_profile_generator import OasisProfileGenerator, OasisAgentProfile
from .simulation_manager import SimulationManager, SimulationState, SimulationStatus
from .simulation_config_generator import (
    SimulationConfigGenerator,
    SimulationParameters,
    AgentActivityConfig,
    TimeSimulationConfig,
    EventConfig,
    PlatformConfig
)
from .zep_graph_memory_updater import (
    ZepGraphMemoryUpdater,
    ZepGraphMemoryManager,
    AgentActivity
)

# OASIS simulation runner requires camel-oasis (Python <3.12)
# Import conditionally so the rest of the backend works without it
try:
    from .simulation_runner import (
        SimulationRunner,
        SimulationRunState,
        RunnerStatus,
        AgentAction,
        RoundSummary
    )
    from .simulation_ipc import (
        SimulationIPCClient,
        SimulationIPCServer,
        IPCCommand,
        IPCResponse,
        CommandType,
        CommandStatus
    )
    _HAS_OASIS = True
except ImportError:
    _HAS_OASIS = False
    SimulationRunner = None
    SimulationRunState = None
    RunnerStatus = None
    AgentAction = None
    RoundSummary = None
    SimulationIPCClient = None
    SimulationIPCServer = None
    IPCCommand = None
    IPCResponse = None
    CommandType = None
    CommandStatus = None

__all__ = [
    'OntologyGenerator',
    'GraphBuilderService',
    'TextProcessor',
    'ZepEntityReader',
    'EntityNode',
    'FilteredEntities',
    'OasisProfileGenerator',
    'OasisAgentProfile',
    'SimulationManager',
    'SimulationState',
    'SimulationStatus',
    'SimulationConfigGenerator',
    'SimulationParameters',
    'AgentActivityConfig',
    'TimeSimulationConfig',
    'EventConfig',
    'PlatformConfig',
    'SimulationRunner',
    'SimulationRunState',
    'RunnerStatus',
    'AgentAction',
    'RoundSummary',
    'ZepGraphMemoryUpdater',
    'ZepGraphMemoryManager',
    'AgentActivity',
    'SimulationIPCClient',
    'SimulationIPCServer',
    'IPCCommand',
    'IPCResponse',
    'CommandType',
    'CommandStatus',
]
